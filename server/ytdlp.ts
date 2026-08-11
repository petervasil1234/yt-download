import { spawn } from 'node:child_process'
import { argsFor, estimate, maxHeightOf, PRESETS, type RawFormat } from './formats.ts'
import { classify } from './errors.ts'
import { parseLine, percentOf, phaseLabel } from './parse.ts'
import type { MediaInfo, Preset, ProbeResult } from '../shared/types.ts'
import type { Runner } from './queue.ts'

const PROGRESS_TEMPLATE =
  'download:@P {"done":%(progress.downloaded_bytes)d,"total":%(progress.total_bytes,progress.total_bytes_estimate)d}'
const POSTPROCESS_TEMPLATE =
  'postprocess:@POST {"pp":"%(progress.postprocessor)s","status":"%(progress.status)s"}'
const FILE_TEMPLATE = 'after_move:@DONE %(filepath)s'
const OUTPUT_TEMPLATE = '%(title)s [%(id)s].%(ext)s'

export async function checkTools(): Promise<{ ytdlp: string | null; ffmpeg: string | null }> {
  const [ytdlp, ffmpeg] = await Promise.all([version('yt-dlp', ['--version']), ffmpegVersion()])
  return { ytdlp, ffmpeg }
}

/**
 * Fetches metadata for a URL.
 *
 * Two steps on purpose. `--flat-playlist` tells us cheaply whether this is a playlist, because a
 * plain `-J` on a playlist would fully extract every single entry. Only once we know it is a single
 * video do we pay for the second call, which is the one that returns the format list we need for the
 * size estimates.
 */
export async function probe(url: string): Promise<ProbeResult> {
  const flat = await runJson(['-J', '--flat-playlist', '--no-warnings', url])

  if (flat._type === 'playlist') {
    const entries = Array.isArray(flat.entries) ? flat.entries : []
    return {
      kind: 'playlist',
      title: str(flat.title) || 'Playlist',
      items: entries.map((entry) => infoFrom(entry as Record<string, unknown>, [])),
    }
  }

  const full = await runJson(['-J', '--no-playlist', '--no-warnings', url])
  const formats = Array.isArray(full.formats) ? (full.formats as RawFormat[]) : []

  return { kind: 'single', item: infoFrom(full, formats) }
}

export type RunnerOptions = {
  outputDir: () => string
  /** Overridable so the progress plumbing can be tested against a stub instead of the network. */
  binary?: string
  extraArgs?: string[]
}

/** Builds the queue runner that actually spawns yt-dlp. */
export function makeRunner(options: RunnerOptions): Runner {
  const { outputDir, binary = 'yt-dlp', extraArgs = [] } = options

  return (job, update, signal) =>
    new Promise<void>((resolve, reject) => {
      const child = spawn(
        binary,
        [
          ...argsFor(job.preset),
          // A queue job is one video. Without this a url carrying &list= would drag in the playlist.
          '--no-playlist',
          '--newline',
          '--no-warnings',
          '--progress-template',
          PROGRESS_TEMPLATE,
          '--progress-template',
          POSTPROCESS_TEMPLATE,
          '--print',
          FILE_TEMPLATE,
          '-o',
          OUTPUT_TEMPLATE,
          '-P',
          outputDir(),
          ...extraArgs,
          job.url,
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      )

      let stderr = ''
      const onAbort = () => child.kill('SIGTERM')
      signal.addEventListener('abort', onAbort, { once: true })

      lines(child.stdout, (line) => {
        const event = parseLine(line)
        if (!event) return

        if (event.kind === 'progress') {
          update({ percent: percentOf(event.done, event.total), phase: null })
        } else if (event.kind === 'phase') {
          const label = event.status === 'finished' ? null : phaseLabel(event.name)
          if (label !== null || event.status === 'finished') update({ phase: label })
        } else if (event.kind === 'file') {
          update({ file: event.path })
        }
      })

      lines(child.stderr, (line) => {
        stderr += `${line}\n`
      })

      child.on('error', (error) => {
        signal.removeEventListener('abort', onAbort)
        reject(new Error(`Could not start ${binary}: ${error.message}`))
      })

      child.on('close', (code) => {
        signal.removeEventListener('abort', onAbort)

        if (signal.aborted) {
          reject(new Error('cancelled'))
          return
        }

        if (code === 0) {
          resolve()
          return
        }

        const failure = classify(stderr)
        reject(new Error(failure.hint ? `${failure.summary} — ${failure.hint}` : failure.summary))
      })
    })
}

function infoFrom(raw: Record<string, unknown>, formats: RawFormat[]): MediaInfo {
  const estimates = Object.fromEntries(
    PRESETS.map((preset) => [preset, formats.length > 0 ? estimate(preset, formats) : null]),
  ) as Record<Preset, number | null>

  return {
    id: str(raw.id),
    title: str(raw.title) || 'Untitled',
    duration: num(raw.duration),
    channel: str(raw.channel) || str(raw.uploader) || str(raw.playlist_uploader),
    thumbnail: pickThumbnail(raw),
    url: str(raw.webpage_url) || str(raw.url),
    estimates,
    maxHeight: maxHeightOf(formats),
  }
}

/** Flat playlist entries carry a thumbnails array but no single `thumbnail` field. */
function pickThumbnail(raw: Record<string, unknown>): string | null {
  const single = str(raw.thumbnail)
  if (single) return single

  const list = raw.thumbnails
  if (!Array.isArray(list) || list.length === 0) return null

  const last = list[list.length - 1] as Record<string, unknown>
  return str(last?.url) || null
}

async function runJson(args: string[]): Promise<Record<string, unknown>> {
  const { code, stdout, stderr } = await run('yt-dlp', args)

  if (code !== 0) {
    const failure = classify(stderr)
    throw new Error(failure.hint ? `${failure.summary} — ${failure.hint}` : failure.summary)
  }

  try {
    return JSON.parse(stdout) as Record<string, unknown>
  } catch {
    throw new Error('yt-dlp returned something that is not JSON.')
  }
}

function run(
  command: string,
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
  })
}

/** Splits a stream into complete lines; yt-dlp writes progress faster than chunk boundaries. */
function lines(stream: NodeJS.ReadableStream, onLine: (line: string) => void): void {
  let buffer = ''

  stream.on('data', (chunk: Buffer) => {
    buffer += chunk.toString()
    const parts = buffer.split('\n')
    buffer = parts.pop() ?? ''
    parts.forEach(onLine)
  })

  stream.on('end', () => {
    if (buffer !== '') onLine(buffer)
  })
}

async function version(command: string, args: string[]): Promise<string | null> {
  try {
    const { code, stdout } = await run(command, args)
    return code === 0 ? stdout.trim().split('\n')[0] : null
  } catch {
    return null
  }
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

async function ffmpegVersion(): Promise<string | null> {
  const line = await version('ffmpeg', ['-version'])
  return line?.match(/ffmpeg version (\S+)/)?.[1] ?? null
}
