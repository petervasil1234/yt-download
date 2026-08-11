import { describe, expect, it, vi } from 'vitest'
import { Queue, type Runner } from './queue.ts'
import type { Job } from '../shared/types.ts'

const request = (title: string) => ({ url: `https://x/${title}`, title, preset: 'best' as const })

/** Waits for the queue to stop having anything left to do. */
async function settle(queue: Queue): Promise<void> {
  for (let i = 0; i < 200; i++) {
    const pending = queue.list().some((j) => j.status === 'queued' || j.status === 'running')
    if (!pending) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error('queue never settled')
}

describe('Queue', () => {
  it('runs jobs one at a time, never two at once', async () => {
    let running = 0
    let peak = 0

    const runner: Runner = async () => {
      running++
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 10))
      running--
    }

    const queue = new Queue(runner, () => {})
    queue.add([request('a'), request('b'), request('c')])
    await settle(queue)

    // Parallel downloads from one address are what triggers YouTube's bot checks.
    expect(peak).toBe(1)
    expect(queue.list().map((j) => j.status)).toEqual(['done', 'done', 'done'])
  })

  it('keeps going after a failure — one bad playlist entry must not stop the rest', async () => {
    const runner: Runner = async (job) => {
      if (job.title === 'b') throw new Error('Video unavailable')
    }

    const queue = new Queue(runner, () => {})
    queue.add([request('a'), request('b'), request('c')])
    await settle(queue)

    expect(queue.list().map((j) => j.status)).toEqual(['done', 'failed', 'done'])
    expect(queue.list()[1].error).toBe('Video unavailable')
  })

  it('preserves the order jobs were added in', async () => {
    const order: string[] = []
    const runner: Runner = async (job) => {
      order.push(job.title)
    }

    const queue = new Queue(runner, () => {})
    queue.add([request('first'), request('second'), request('third')])
    await settle(queue)

    expect(order).toEqual(['first', 'second', 'third'])
  })

  it('passes progress updates through to the job', async () => {
    const runner: Runner = async (_job, update) => {
      update({ percent: 42, phase: 'merging video and audio' })
    }

    const queue = new Queue(runner, () => {})
    queue.add([request('a')])
    await settle(queue)

    const job = queue.list()[0]
    expect(job.status).toBe('done')
    expect(job.percent).toBe(100)
  })

  it('cancels a queued job without ever starting it', async () => {
    const started: string[] = []
    const runner: Runner = async (job) => {
      started.push(job.title)
      await new Promise((resolve) => setTimeout(resolve, 20))
    }

    const queue = new Queue(runner, () => {})
    const [, second] = queue.add([request('a'), request('b')])
    queue.cancel(second.id)
    await settle(queue)

    expect(started).toEqual(['a'])
    expect(queue.list()[1].status).toBe('cancelled')
  })

  it('aborts a running job and does not mark it done afterwards', async () => {
    const runner: Runner = (_job, _update, signal) =>
      new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')))
        setTimeout(resolve, 500)
      })

    const queue = new Queue(runner, () => {})
    const [job] = queue.add([request('a')])
    await new Promise((resolve) => setTimeout(resolve, 10))
    queue.cancel(job.id)
    await settle(queue)

    expect(queue.list()[0].status).toBe('cancelled')
    // A cancel is not a failure, so there must be no error text to alarm the user.
    expect(queue.list()[0].error).toBeNull()
  })

  it('notifies on every state change, so the UI stream stays in step', async () => {
    const onChange = vi.fn()
    const queue = new Queue(async () => {}, onChange)

    queue.add([request('a')])
    await settle(queue)

    // add + running + done at the very least.
    expect(onChange.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('clears finished jobs but keeps the ones still in flight', async () => {
    const runner: Runner = async (job) => {
      if (job.title === 'slow') await new Promise((resolve) => setTimeout(resolve, 60))
    }

    const queue = new Queue(runner, () => {})
    queue.add([request('fast'), request('slow')])
    await new Promise((resolve) => setTimeout(resolve, 25))

    queue.clearFinished()
    const titles = queue.list().map((j: Job) => j.title)

    expect(titles).not.toContain('fast')
    expect(titles).toContain('slow')
    await settle(queue)
  })

  it('gives every job a distinct id, even for the same url', () => {
    const queue = new Queue(async () => {}, () => {})
    const jobs = queue.add([request('a'), request('a')])

    expect(jobs[0].id).not.toBe(jobs[1].id)
  })
})
