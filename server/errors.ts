/**
 * Turns yt-dlp's stderr into something worth showing.
 *
 * yt-dlp's own messages are good, so the raw text is always kept — this only adds a heading for the
 * cases that come up often, and a hint where the fix is not obvious from the message itself.
 */

export type Failure = {
  /** Short, human-readable heading. */
  summary: string
  /** What to do about it, when there is anything to do. */
  hint: string | null
  /** yt-dlp's own words, kept verbatim — translating them away would lose information. */
  detail: string
}

type Rule = { match: RegExp; summary: string; hint: string | null }

/*
 * The patterns are matched against real yt-dlp output. Order matters: the first match wins, so the
 * specific cases come before the general ones.
 */
const RULES: Rule[] = [
  {
    match: /is not a valid URL/i,
    summary: 'That is not a link',
    hint: 'Paste a full YouTube address, for example https://www.youtube.com/watch?v=…',
  },
  {
    match: /Private video/i,
    summary: 'The video is private',
    hint: 'Only the owner and invited accounts can see it. Signing in is not supported here.',
  },
  {
    match: /Sign in to confirm your age|age-restricted|inappropriate for some users/i,
    summary: 'The video is age restricted',
    hint: 'YouTube demands a signed-in account for this one, which this tool does not do.',
  },
  {
    match: /not available in your country|blocked it in your country|geo restricted/i,
    summary: 'The video is blocked in this region',
    hint: null,
  },
  {
    match: /Video unavailable/i,
    summary: 'The video is unavailable',
    hint: 'It may have been deleted, or the address may have a typo.',
  },
  {
    match: /members-only|join this channel/i,
    summary: 'The video is for channel members',
    hint: null,
  },
  {
    match: /DRM protected/i,
    summary: 'The video is DRM protected',
    hint: 'Nothing can be done about this one.',
  },
  {
    match: /Requested format is not available/i,
    summary: 'That quality is not available',
    hint: 'Pick a lower one — YouTube does not offer every resolution for every video.',
  },
  {
    match: /Unable to download webpage|Failed to resolve|Connection refused|timed out/i,
    summary: 'Could not reach YouTube',
    hint: 'Check the network connection and try again.',
  },
  {
    match: /Please (report this issue|update|install)|update to the latest version|yt-dlp is out of date/i,
    summary: 'yt-dlp is out of date',
    hint: 'YouTube changes often. Run brew upgrade yt-dlp and try again.',
  },
  {
    match: /Sign in to confirm you.{0,3}re not a bot|confirm you are not a bot/i,
    summary: 'YouTube is asking for a bot check',
    hint: 'It usually passes on its own after a while. Downloading a lot in a row triggers it.',
  },
  {
    match: /ffmpeg (is )?not (found|installed)|ffprobe.*not found/i,
    summary: 'ffmpeg is missing',
    hint: 'Install it with brew install ffmpeg — merging video and audio needs it.',
  },
]

export function classify(stderr: string): Failure {
  const detail = lastError(stderr)

  for (const rule of RULES) {
    if (rule.match.test(detail)) {
      return { summary: rule.summary, hint: rule.hint, detail }
    }
  }

  return { summary: 'Download failed', hint: null, detail }
}

/**
 * The last ERROR: line, or the tail of the output when there is none.
 *
 * yt-dlp prints progress and warnings before the failure, so the interesting part is at the end —
 * and the final ERROR line is the one that actually stopped it.
 */
function lastError(stderr: string): string {
  const lines = stderr.split('\n').map((l) => l.trim()).filter(Boolean)
  const errors = lines.filter((l) => l.startsWith('ERROR:'))

  if (errors.length > 0) {
    return errors[errors.length - 1].replace(/^ERROR:\s*/, '')
  }

  return lines.slice(-3).join(' ') || 'yt-dlp exited without a message.'
}
