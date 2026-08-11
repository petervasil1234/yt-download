import { describe, expect, it } from 'vitest'
import { parseLine, percentOf, phaseLabel } from './parse.ts'

/*
 * The fixtures below are real lines captured from yt-dlp 2026.03.17 running our own templates,
 * not invented ones — the point of this parser is to survive what the tool actually emits.
 */

describe('parseLine', () => {
  it('reads a progress line', () => {
    expect(parseLine('@P {"done":15360,"total":252182}')).toEqual({
      kind: 'progress',
      done: 15360,
      total: 252182,
    })
  })

  it('keeps an unknown total as 0 rather than guessing a size', () => {
    // Live streams and some adaptive formats report no total at all.
    expect(parseLine('@P {"done":4096}')).toEqual({ kind: 'progress', done: 4096, total: 0 })
  })

  it('reads a postprocessor phase', () => {
    expect(parseLine('@POST {"pp":"Merger","status":"started"}')).toEqual({
      kind: 'phase',
      name: 'Merger',
      status: 'started',
    })
  })

  it('reads the final path, which is the only trustworthy source of the file name', () => {
    // The container is decided during the merge, so the extension cannot be predicted up front.
    expect(parseLine('@DONE /Users/me/Downloads/Me at the zoo [jNQXAC9IVRw].webm')).toEqual({
      kind: 'file',
      path: '/Users/me/Downloads/Me at the zoo [jNQXAC9IVRw].webm',
    })
  })

  it('keeps spaces in file names instead of splitting on them', () => {
    const event = parseLine('@DONE /tmp/A Very Long Title.mp4')
    expect(event).toEqual({ kind: 'file', path: '/tmp/A Very Long Title.mp4' })
  })

  it('recognises an ERROR line', () => {
    expect(parseLine('ERROR: [youtube] AAA: Video unavailable')).toEqual({
      kind: 'error',
      message: '[youtube] AAA: Video unavailable',
    })
  })

  it('ignores yt-dlp chatter, so unknown output cannot be mistaken for an event', () => {
    expect(parseLine('[youtube] Extracting URL: https://…')).toBeNull()
    expect(parseLine('[download] Destination: x.webm')).toBeNull()
    expect(parseLine('')).toBeNull()
  })

  it('ignores a malformed marker instead of throwing mid-download', () => {
    expect(parseLine('@P not-json')).toBeNull()
    expect(parseLine('@POST {"nope":1}')).toBeNull()
    expect(parseLine('@DONE   ')).toBeNull()
  })
})

describe('percentOf', () => {
  it('returns null when the total is unknown — a fake 0% would look like a stall', () => {
    expect(percentOf(1024, 0)).toBeNull()
  })

  it('rounds to whole percent', () => {
    expect(percentOf(15360, 252182)).toBe(6)
  })

  it('never exceeds 100, because reported totals are estimates', () => {
    expect(percentOf(300, 200)).toBe(100)
  })
})

describe('phaseLabel', () => {
  it('translates the postprocessors a user would notice', () => {
    expect(phaseLabel('Merger')).toBe('merging video and audio')
    expect(phaseLabel('FFmpegExtractAudio')).toBe('extracting audio')
  })

  it('returns null for internal postprocessors so the UI stays quiet about them', () => {
    expect(phaseLabel('SponsorBlock')).toBeNull()
  })
})
