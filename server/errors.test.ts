import { describe, expect, it } from 'vitest'
import { classify } from './errors.ts'

/* All inputs are real yt-dlp 2026.03.17 stderr text. */

describe('classify', () => {
  it('recognises an unavailable video', () => {
    const failure = classify('ERROR: [youtube] AAAAAAAAAAA: Video unavailable')

    expect(failure.summary).toBe('The video is unavailable')
    expect(failure.detail).toBe('[youtube] AAAAAAAAAAA: Video unavailable')
  })

  it('recognises a malformed link and says what a good one looks like', () => {
    const failure = classify("ERROR: [generic] 'nie-je-url' is not a valid URL")

    expect(failure.summary).toBe('That is not a link')
    expect(failure.hint).toMatch(/youtube\.com\/watch/)
  })

  it('recognises an unavailable quality and points at the fix', () => {
    const failure = classify(
      'ERROR: [youtube] jNQXAC9IVRw: Requested format is not available. Use --list-formats for a list of available formats',
    )

    expect(failure.summary).toBe('That quality is not available')
    expect(failure.hint).toMatch(/lower/)
  })

  it('recognises the bot check, which is the one users hit after many downloads', () => {
    expect(classify('ERROR: Sign in to confirm you’re not a bot').summary).toBe(
      'YouTube is asking for a bot check',
    )
  })

  it('recognises an outdated yt-dlp, the most common cause of sudden breakage', () => {
    expect(classify('ERROR: Please update yt-dlp to the latest version').summary).toBe(
      'yt-dlp is out of date',
    )
  })

  it('always keeps yt-dlp own wording, even when nothing matches', () => {
    // yt-dlp messages are good; discarding them would throw away the only real diagnostic.
    const failure = classify('ERROR: something entirely new happened')

    expect(failure.summary).toBe('Download failed')
    expect(failure.detail).toBe('something entirely new happened')
  })

  it('picks the last ERROR line, not the first, because that is what stopped it', () => {
    const stderr = [
      '[youtube] Extracting URL: https://…',
      'ERROR: unable to download webpage: retrying',
      'ERROR: [youtube] X: Private video',
    ].join('\n')

    expect(classify(stderr).summary).toBe('The video is private')
  })

  it('falls back to the tail of the output when there is no ERROR line', () => {
    const failure = classify('[download] something\nkilled by signal')

    expect(failure.detail).toContain('killed by signal')
  })

  it('never returns an empty detail, so the UI always has something to show', () => {
    expect(classify('').detail).not.toBe('')
  })
})
