import { describe, expect, it } from 'vitest'
import { argsFor, estimate, maxHeightOf, type RawFormat } from './formats.ts'

describe('argsFor', () => {
  it('caps the height for a resolution preset', () => {
    expect(argsFor('720p')).toEqual(['-f', 'bv*[height<=720]+ba/b[height<=720]/b'])
  })

  it('every selector ends in a plain fallback, so a video without adaptive streams still works', () => {
    for (const preset of ['best', '1080p', '720p', '480p'] as const) {
      expect(argsFor(preset)[1].endsWith('/b')).toBe(true)
    }
  })

  it('asks yt-dlp to convert audio, not merely to pick an audio stream', () => {
    // Without --extract-audio the output would be a video container holding only audio.
    expect(argsFor('audio')).toEqual(['-f', 'ba/b', '--extract-audio', '--audio-format', 'm4a'])
  })
})

/*
 * The real eleven formats YouTube offered for jNQXAC9IVRw, in the order `yt-dlp -J` returned them.
 * The order is the whole point: yt-dlp sorts worst to best by its own preference, so the last
 * matching entry is the one a selector picks.
 */
const FORMATS: RawFormat[] = [
  { vcodec: 'none', acodec: 'mp4a.40.5', filesize: 117526 },
  { vcodec: 'none', acodec: 'opus', filesize: 112596 },
  { vcodec: 'none', acodec: 'mp4a.40.2', filesize: 309288 },
  { vcodec: 'none', acodec: 'opus', filesize: 252182 },
  { vcodec: 'avc1.4d400b', acodec: 'none', height: 144, filesize: 195278 },
  { vcodec: 'vp9', acodec: 'none', height: 144, filesize: 185292 },
  { vcodec: 'avc1.4d400c', acodec: 'none', height: 240, filesize: 322379 },
  { vcodec: 'avc1.4d400c', acodec: 'none', height: 240, filesize: 433081 },
  { vcodec: 'avc1.42001E', acodec: 'mp4a.40.2', height: 240, filesize: null, filesize_approx: 635110 },
  { vcodec: 'vp9', acodec: 'none', height: 240, filesize: 293080 },
  { vcodec: 'av01.0.00M.08', acodec: 'none', height: 240, filesize: 223779 },
]

describe('estimate', () => {
  it('matches what yt-dlp actually downloads', () => {
    // `yt-dlp -f "bv*+ba/b" --print "%(format_id)s %(filesize,filesize_approx)d"` on this video
    // answered "395+251  475961". Picking the largest files instead would say 742369 — 56% too high.
    expect(estimate('best', FORMATS)).toBe(475961)
  })

  it('respects the height cap', () => {
    // Only the two 144p streams qualify; the preferred one is the later vp9 entry.
    expect(estimate('480p', FORMATS.filter((f) => (f.height ?? 0) <= 144 || f.vcodec === 'none'))).toBe(
      185292 + 252182,
    )
  })

  it('counts audio alone for the audio preset', () => {
    expect(estimate('audio', FORMATS)).toBe(252182)
  })

  it('falls back to a combined format when there are no adaptive streams', () => {
    // Mirrors the `/b` branch of the selector, so the UI does not claim an unknown size.
    expect(estimate('best', [FORMATS[8]])).toBe(635110)
  })

  it('returns null when the source reports no sizes at all', () => {
    expect(estimate('best', [{ vcodec: 'vp9', acodec: 'none', height: 720 }])).toBeNull()
  })

  it('uses filesize_approx when the exact size is missing', () => {
    expect(estimate('audio', [{ vcodec: 'none', acodec: 'opus', filesize_approx: 999 }])).toBe(999)
  })

  it('walks back to a neighbour when the preferred format reports no size', () => {
    // "Unknown" is a worse answer than a same-resolution neighbour's size.
    const formats: RawFormat[] = [
      { vcodec: 'none', acodec: 'opus', filesize: 5000 },
      { vcodec: 'none', acodec: 'opus' },
    ]
    expect(estimate('audio', formats)).toBe(5000)
  })
})

describe('maxHeightOf', () => {
  it('reports the tallest video on offer, so unavailable presets can be greyed out', () => {
    expect(maxHeightOf(FORMATS)).toBe(240)
  })

  it('reports 0 for audio-only sources', () => {
    expect(maxHeightOf([{ vcodec: 'none', acodec: 'opus' }])).toBe(0)
  })
})
