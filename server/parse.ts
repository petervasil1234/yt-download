/**
 * Parses the machine-readable lines yt-dlp emits for us.
 *
 * The markers come from our own --progress-template and --print arguments (see ytdlp.ts), so this
 * is a contract with ourselves rather than with yt-dlp's human-facing output, which changes freely.
 */

export type YtEvent =
  | { kind: 'progress'; done: number; total: number }
  | { kind: 'phase'; name: string; status: 'started' | 'processing' | 'finished' }
  | { kind: 'file'; path: string }
  | { kind: 'error'; message: string }

export function parseLine(line: string): YtEvent | null {
  const text = line.trim()
  if (text === '') return null

  if (text.startsWith('@P ')) {
    const data = json(text.slice(3))
    if (typeof data?.done !== 'number') return null
    // total can be 0 when the size is unknown; percentage is then undecidable, not zero.
    return { kind: 'progress', done: data.done, total: typeof data.total === 'number' ? data.total : 0 }
  }

  if (text.startsWith('@POST ')) {
    const data = json(text.slice(6))
    if (typeof data?.pp !== 'string') return null
    return { kind: 'phase', name: data.pp, status: normalizeStatus(data.status) }
  }

  if (text.startsWith('@DONE ')) {
    const path = text.slice(6).trim()
    return path === '' ? null : { kind: 'file', path }
  }

  if (text.startsWith('ERROR:')) {
    return { kind: 'error', message: text.slice(6).trim() }
  }

  return null
}

/** Percentage, or null when the total size is unknown — never a made-up zero. */
export function percentOf(done: number, total: number): number | null {
  if (total <= 0) return null
  return Math.min(100, Math.round((done / total) * 100))
}

/** yt-dlp postprocessor names are class names; these are the ones worth showing. */
const PHASE_LABELS: Record<string, string> = {
  Merger: 'merging video and audio',
  FFmpegMerger: 'merging video and audio',
  ExtractAudio: 'extracting audio',
  FFmpegExtractAudio: 'extracting audio',
  MoveFiles: 'moving into place',
  FFmpegVideoConvertor: 'converting',
}

export function phaseLabel(name: string): string | null {
  return PHASE_LABELS[name] ?? null
}

function normalizeStatus(value: unknown): 'started' | 'processing' | 'finished' {
  return value === 'finished' || value === 'processing' ? value : 'started'
}

function json(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text)
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}
