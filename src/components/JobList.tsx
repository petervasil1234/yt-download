import { Check, FolderOpen, Loader2, TriangleAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PRESET_LABELS } from '@/lib/presets'
import { fileName } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Job } from '#shared/types.ts'

type Props = {
  jobs: Job[]
  outputDir: string
  onCancel: (id: string) => void
  onClear: () => void
  onReveal: () => void
}

export function JobList({ jobs, outputDir, onCancel, onClear, onReveal }: Props) {
  if (jobs.length === 0) return null

  const finished = jobs.some((job) => job.status !== 'queued' && job.status !== 'running')

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="eyebrow m-0">Queue</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onReveal}>
            <FolderOpen className="size-4" aria-hidden />
            Open folder
          </Button>
          {finished && (
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear finished
            </Button>
          )}
        </div>
      </div>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {jobs.map((job) => (
          <Row key={job.id} job={job} onCancel={() => onCancel(job.id)} />
        ))}
      </ul>

      <p className="m-0 font-mono text-[11px] break-all text-ink-3">{outputDir}</p>
    </section>
  )
}

function Row({ job, onCancel }: { job: Job; onCancel: () => void }) {
  const active = job.status === 'running' || job.status === 'queued'

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center gap-3">
        <StatusIcon status={job.status} />

        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-sm font-medium">{job.title}</p>
          <p className="m-0 text-[12px] text-ink-3">
            {job.file !== null ? fileName(job.file) : PRESET_LABELS[job.preset]}
          </p>
        </div>

        {active && (
          <Button variant="ghost" size="sm" onClick={onCancel} aria-label={`Cancel ${job.title}`}>
            <X className="size-4" aria-hidden />
          </Button>
        )}
      </div>

      {job.status === 'running' && <Progress percent={job.percent} phase={job.phase} />}

      {job.status === 'failed' && job.error !== null && (
        <p className="m-0 text-[13px] text-bad">{job.error}</p>
      )}
    </li>
  )
}

function Progress({ percent, phase }: { percent: number | null; phase: string | null }) {
  // A phase such as merging has no percentage of its own — the bar would sit still and look stuck.
  if (phase !== null) {
    return (
      <p className="m-0 flex items-center gap-2 text-[12px] text-ink-2">
        <Loader2 className="size-3 animate-spin" aria-hidden />
        {phase}
      </p>
    )
  }

  if (percent === null) {
    return <p className="m-0 text-[12px] text-ink-3">starting…</p>
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="w-9 text-right font-mono text-[11px] text-ink-3">{percent}%</span>
    </div>
  )
}

function StatusIcon({ status }: { status: Job['status'] }) {
  const base = 'flex size-5 shrink-0 items-center justify-center rounded-full'

  if (status === 'done') {
    return (
      <span className={cn(base, 'bg-ok text-ok-soft')}>
        <Check className="size-3" strokeWidth={3} aria-hidden />
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className={cn(base, 'text-bad')}>
        <TriangleAlert className="size-4" aria-hidden />
      </span>
    )
  }
  if (status === 'running') {
    return (
      <span className={cn(base, 'text-brand')}>
        <Loader2 className="size-4 animate-spin" aria-hidden />
      </span>
    )
  }
  if (status === 'cancelled') {
    return (
      <span className={cn(base, 'text-ink-3')}>
        <X className="size-4" aria-hidden />
      </span>
    )
  }
  return <span className={cn(base, 'font-mono text-[10px] text-ink-3')}>·</span>
}
