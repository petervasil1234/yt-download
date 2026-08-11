import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { makeRunner } from './ytdlp.ts'
import type { Job } from '../shared/types.ts'

/*
 * These exercise the whole spawn → stdout → parse → update path against a stub binary.
 *
 * A real download of a short video finishes faster than any progress event can be observed, so
 * without a stub there is no evidence the progress plumbing works at all — and "the bar never
 * moved" is exactly the kind of thing that only shows up on a slow connection in real use.
 */
function stub(script: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'ytstub-'))
  const path = join(dir, 'fake-yt-dlp')
  writeFileSync(path, `#!/bin/sh\n${script}\n`)
  chmodSync(path, 0o755)
  return path
}

const job: Job = {
  id: '1',
  url: 'https://example/x',
  title: 'x',
  preset: 'best',
  status: 'running',
  percent: null,
  phase: null,
  file: null,
  error: null,
}

async function collect(script: string): Promise<{ patches: Partial<Job>[]; error: Error | null }> {
  const runner = makeRunner({ outputDir: () => tmpdir(), binary: stub(script) })
  const patches: Partial<Job>[] = []

  try {
    await runner({ ...job }, (patch) => patches.push(patch), new AbortController().signal)
    return { patches, error: null }
  } catch (error) {
    return { patches, error: error as Error }
  }
}

describe('makeRunner', () => {
  it('turns progress lines into percentages', async () => {
    const { patches } = await collect(`
      echo '@P {"done":25000,"total":100000}'
      echo '@P {"done":50000,"total":100000}'
      echo '@P {"done":100000,"total":100000}'
    `)

    expect(patches.map((p) => p.percent)).toEqual([25, 50, 100])
  })

  it('leaves the percentage unknown when yt-dlp reports no total size', async () => {
    // Live streams do this. A bar stuck at 0% would read as a stall.
    const { patches } = await collect(`echo '@P {"done":4096,"total":0}'`)

    expect(patches[0].percent).toBeNull()
  })

  it('reports the merge phase, then clears it when the phase finishes', async () => {
    const { patches } = await collect(`
      echo '@POST {"pp":"Merger","status":"started"}'
      echo '@POST {"pp":"Merger","status":"finished"}'
    `)

    expect(patches.map((p) => p.phase)).toEqual(['merging video and audio', null])
  })

  it('records the final path from @DONE, the only place the real extension appears', async () => {
    const { patches } = await collect(`echo '@DONE /tmp/Some Title [abc].webm'`)

    expect(patches.at(-1)?.file).toBe('/tmp/Some Title [abc].webm')
  })

  it('survives output split across chunk boundaries', async () => {
    // printf without a trailing newline on the last line is the boundary case.
    const { patches } = await collect(`printf '@P {"done":1,"total":10}\\n@P {"done":5,"total":10}'`)

    expect(patches.map((p) => p.percent)).toEqual([10, 50])
  })

  it('classifies a non-zero exit using yt-dlp own stderr', async () => {
    const { error } = await collect(`
      echo 'ERROR: [youtube] X: Private video' >&2
      exit 1
    `)

    expect(error?.message).toContain('The video is private')
  })

  it('reports a missing binary as a startable problem, not a download failure', async () => {
    const runner = makeRunner({ outputDir: () => tmpdir(), binary: '/nonexistent/yt-dlp' })

    await expect(
      runner({ ...job }, () => {}, new AbortController().signal),
    ).rejects.toThrow(/Could not start/)
  })

  it('kills the process on abort and reports it as cancelled', async () => {
    const runner = makeRunner({ outputDir: () => tmpdir(), binary: stub('sleep 30') })
    const controller = new AbortController()

    const promise = runner({ ...job }, () => {}, controller.signal)
    await new Promise((resolve) => setTimeout(resolve, 50))
    controller.abort()

    await expect(promise).rejects.toThrow(/cancelled/)
  })

  it('ignores yt-dlp human-facing chatter', async () => {
    const { patches, error } = await collect(`
      echo '[youtube] Extracting URL: https://x'
      echo '[download] Destination: x.webm'
      echo '[Merger] Merging formats into "x.webm"'
    `)

    expect(patches).toEqual([])
    expect(error).toBeNull()
  })
})
