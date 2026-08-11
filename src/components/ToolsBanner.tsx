import { TriangleAlert } from 'lucide-react'
import type { ServerState } from '#shared/types.ts'

/**
 * A missing dependency is the way a wrapper like this actually breaks, so it is reported before
 * anything else and blocks the rest of the UI rather than letting every download fail one by one.
 */
export function ToolsBanner({ tools }: { tools: ServerState['tools'] }) {
  const missing: { name: string; install: string; why: string }[] = []

  if (!tools.ytdlp) {
    missing.push({
      name: 'yt-dlp',
      install: 'brew install yt-dlp',
      why: 'does all the actual work',
    })
  }
  if (!tools.ffmpeg) {
    missing.push({
      name: 'ffmpeg',
      install: 'brew install ffmpeg',
      why: 'YouTube serves video and audio separately, and they have to be merged',
    })
  }

  if (missing.length === 0) return null

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-bad/35 bg-bad-soft px-4 py-4"
    >
      <p className="m-0 flex items-center gap-2 font-medium text-bad">
        <TriangleAlert className="size-4 shrink-0" aria-hidden />
        {missing.length === 1 ? 'A required tool is missing' : 'Required tools are missing'}
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {missing.map((tool) => (
          <li key={tool.name} className="text-sm text-ink-2">
            <b className="text-ink">{tool.name}</b> — {tool.why}
            <code className="mt-1 block w-fit rounded bg-surface px-2 py-1 font-mono text-[13px] text-ink">
              {tool.install}
            </code>
          </li>
        ))}
      </ul>
      <p className="m-0 text-[13px] text-ink-3">Restart the server once they are installed.</p>
    </div>
  )
}
