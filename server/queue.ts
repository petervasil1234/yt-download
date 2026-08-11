import type { Job, JobStatus, Preset } from '../shared/types.ts'

export type JobRequest = { url: string; title: string; preset: Preset }

export type Runner = (
  job: Job,
  update: (patch: Partial<Job>) => void,
  signal: AbortSignal,
) => Promise<void>

/**
 * Runs downloads one at a time.
 *
 * Serial on purpose: parallel downloads from one address are what makes YouTube start asking for bot
 * checks, and they do not finish sooner anyway — the bottleneck is bandwidth, not concurrency.
 *
 * The runner is injected so the queue can be tested without spawning anything.
 */
export class Queue {
  private jobs: Job[] = []
  private controllers = new Map<string, AbortController>()
  private draining = false
  private nextId = 1

  private readonly runner: Runner
  private readonly onChange: () => void

  constructor(runner: Runner, onChange: () => void) {
    this.runner = runner
    this.onChange = onChange
  }

  list(): Job[] {
    return this.jobs.map((job) => ({ ...job }))
  }

  add(requests: JobRequest[]): Job[] {
    const added = requests.map((request) => ({
      id: String(this.nextId++),
      url: request.url,
      title: request.title,
      preset: request.preset,
      status: 'queued' as JobStatus,
      percent: null,
      phase: null,
      file: null,
      error: null,
    }))

    this.jobs.push(...added)
    this.onChange()
    void this.drain()

    return added.map((job) => ({ ...job }))
  }

  /** Cancels a job whether it is already running or still waiting. */
  cancel(id: string): boolean {
    const job = this.jobs.find((candidate) => candidate.id === id)
    if (!job) return false

    if (job.status === 'running') {
      this.controllers.get(id)?.abort()
      return true
    }

    if (job.status === 'queued') {
      this.patch(id, { status: 'cancelled' })
      return true
    }

    return false
  }

  /** Forgets finished jobs. Anything still queued or running stays. */
  clearFinished(): void {
    this.jobs = this.jobs.filter(
      (job) => job.status === 'queued' || job.status === 'running',
    )
    this.onChange()
  }

  private patch(id: string, patch: Partial<Job>): void {
    const job = this.jobs.find((candidate) => candidate.id === id)
    if (!job) return

    Object.assign(job, patch)
    this.onChange()
  }

  private async drain(): Promise<void> {
    if (this.draining) return
    this.draining = true

    try {
      for (;;) {
        const job = this.jobs.find((candidate) => candidate.status === 'queued')
        if (!job) return

        const controller = new AbortController()
        this.controllers.set(job.id, controller)
        this.patch(job.id, { status: 'running', percent: null, phase: null, error: null })

        try {
          await this.runner(
            { ...job },
            (patch) => this.patch(job.id, patch),
            controller.signal,
          )
          // A cancel that lands mid-flight must not be reported as success.
          const finished = this.jobs.find((candidate) => candidate.id === job.id)
          if (finished?.status === 'running') {
            this.patch(job.id, { status: 'done', percent: 100, phase: null })
          }
        } catch (error) {
          // One failure must not stop the rest of the queue — that is the whole point of a playlist.
          this.patch(job.id, {
            status: controller.signal.aborted ? 'cancelled' : 'failed',
            phase: null,
            error: controller.signal.aborted ? null : messageOf(error),
          })
        } finally {
          this.controllers.delete(job.id)
        }
      }
    } finally {
      this.draining = false
    }
  }
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Download failed for an unknown reason.'
}
