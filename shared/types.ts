/** Types shared by the server and the browser UI. */

export type Preset = 'best' | '1080p' | '720p' | '480p' | 'audio'

export type MediaInfo = {
  id: string
  title: string
  /** Seconds; 0 when the source does not report a duration (live streams). */
  duration: number
  channel: string
  thumbnail: string | null
  url: string
  /** Estimated output size in bytes per preset; null when the source gives no sizes. */
  estimates: Record<Preset, number | null>
  /** Highest resolution actually on offer, for greying out presets above it. */
  maxHeight: number
}

export type ProbeResult =
  | { kind: 'single'; item: MediaInfo }
  | { kind: 'playlist'; title: string; items: MediaInfo[] }

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'

export type Job = {
  id: string
  url: string
  title: string
  preset: Preset
  status: JobStatus
  /** 0–100, or null before the first progress event arrives. */
  percent: number | null
  /** What yt-dlp is doing right now, e.g. "merging" — shown instead of a percentage. */
  phase: string | null
  /** Absolute path of the finished file. */
  file: string | null
  error: string | null
}

export type ServerState = {
  jobs: Job[]
  /** Missing tools block everything, so the UI needs to know before anything else. */
  tools: { ytdlp: string | null; ffmpeg: string | null }
  outputDir: string
}
