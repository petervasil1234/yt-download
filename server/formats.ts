import type { Preset } from '../shared/types.ts'

/**
 * Maps a preset to yt-dlp arguments.
 *
 * The UI deliberately does not expose raw format ids: which of the eleven formats YouTube offers is
 * the right one is yt-dlp's job, not the user's. Every selector ends with a plain `/b` fallback so a
 * video that has no separate streams still downloads instead of failing.
 */
export function argsFor(preset: Preset): string[] {
  if (preset === 'audio') {
    return ['-f', 'ba/b', '--extract-audio', '--audio-format', 'm4a']
  }

  if (preset === 'best') {
    return ['-f', 'bv*+ba/b']
  }

  const height = HEIGHTS[preset]
  return ['-f', `bv*[height<=${height}]+ba/b[height<=${height}]/b`]
}

const HEIGHTS: Record<Exclude<Preset, 'best' | 'audio'>, number> = {
  '1080p': 1080,
  '720p': 720,
  '480p': 480,
}

export const PRESETS: Preset[] = ['best', '1080p', '720p', '480p', 'audio']

/** A format entry as it appears in `yt-dlp -J` output. */
export type RawFormat = {
  vcodec?: string | null
  acodec?: string | null
  height?: number | null
  filesize?: number | null
  filesize_approx?: number | null
}

/**
 * Estimated output size for a preset.
 *
 * The trick is that `yt-dlp -J` returns the format list ordered worst to best by yt-dlp's own
 * preference, so the *last* matching entry is the one the selector will pick. Verified against
 * `yt-dlp -f "bv*+ba/b" --print filesize`, which chose 395+251 where picking the largest file
 * would have named 133+140 and overstated the result by more than half.
 *
 * Using yt-dlp's ordering rather than our own quality judgement is also what keeps this from
 * drifting: we are reading its opinion, not forming a competing one.
 */
export function estimate(preset: Preset, formats: RawFormat[]): number | null {
  const audio = preferredSize(formats.filter(isAudioOnly))

  if (preset === 'audio') return audio

  const cap = preset === 'best' ? Infinity : HEIGHTS[preset]
  const video = preferredSize(formats.filter((f) => isVideoOnly(f) && (f.height ?? 0) <= cap))

  if (video === null && audio === null) {
    // No adaptive streams — fall back to the combined format, matching the `/b` branch.
    return preferredSize(formats.filter((f) => !isVideoOnly(f) && !isAudioOnly(f)))
  }

  return (video ?? 0) + (audio ?? 0) || null
}

export function maxHeightOf(formats: RawFormat[]): number {
  return formats.reduce((max, f) => Math.max(max, f.height ?? 0), 0)
}

function isAudioOnly(f: RawFormat): boolean {
  return hasCodec(f.acodec) && !hasCodec(f.vcodec)
}

function isVideoOnly(f: RawFormat): boolean {
  return hasCodec(f.vcodec) && !hasCodec(f.acodec)
}

function hasCodec(codec: string | null | undefined): boolean {
  return typeof codec === 'string' && codec !== '' && codec !== 'none'
}

function sizeOf(f: RawFormat): number | null {
  return f.filesize ?? f.filesize_approx ?? null
}

/**
 * Size of the candidate yt-dlp would prefer — the last one in the list.
 *
 * When that one reports no size we walk backwards to the closest one that does, rather than giving
 * up: a neighbouring format of the same resolution is a far better answer than "unknown".
 */
function preferredSize(formats: RawFormat[]): number | null {
  for (let i = formats.length - 1; i >= 0; i--) {
    const size = sizeOf(formats[i])
    if (size !== null) return size
  }
  return null
}
