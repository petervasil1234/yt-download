import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { JobList } from '@/components/JobList'
import { MediaCard } from '@/components/MediaCard'
import { PlaylistPicker } from '@/components/PlaylistPicker'
import { ToolsBanner } from '@/components/ToolsBanner'
import { UrlBar } from '@/components/UrlBar'
import { useServerState } from '@/hooks/useServerState'
import * as api from '@/lib/api'
import type { Preset, ProbeResult } from '#shared/types.ts'

export function App() {
  const { state, connected } = useServerState()
  const [result, setResult] = useState<ProbeResult | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [preset, setPreset] = useState<Preset>('best')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const ready = state.tools.ytdlp !== null && state.tools.ffmpeg !== null

  async function lookUp(url: string) {
    setBusy(true)
    setError(null)
    setResult(null)

    try {
      const probed = await api.probe(url)
      setResult(probed)
      // Everything is selected by default; deselecting a few is less work than picking many.
      setSelected(
        probed.kind === 'playlist' ? new Set(probed.items.map((item) => item.id)) : new Set(),
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Look-up failed.')
    } finally {
      setBusy(false)
    }
  }

  async function download() {
    if (!result) return

    const items =
      result.kind === 'single'
        ? [{ url: result.item.url, title: result.item.title }]
        : result.items
            .filter((item) => selected.has(item.id))
            .map((item) => ({ url: item.url, title: item.title }))

    setBusy(true)
    setError(null)

    try {
      await api.enqueue(items, preset)
      // The queue below takes over from here, so the lookup panel gets out of the way.
      setResult(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not queue the download.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-5 pt-8 pb-16">
      <header className="flex flex-col gap-2 border-b border-line pb-5">
        <span className="eyebrow">yt-download</span>
        <h1 className="display m-0 text-[clamp(26px,4.4vw,36px)]">
          A window onto yt-dlp, running on your own machine
        </h1>
        <p className="m-0 text-ink-2">
          Paste a link, pick a quality, watch it come down. No server, no upload, no account.
        </p>
      </header>

      <ToolsBanner tools={state.tools} />

      <UrlBar busy={busy} disabled={!ready} onSubmit={lookUp} />

      {!connected && (
        <p className="m-0 text-[13px] text-warn">
          Not connected to the local server. Is it still running?
        </p>
      )}

      {error !== null && (
        <p
          role="alert"
          className="m-0 flex items-start gap-2 rounded-lg border border-bad/35 bg-bad-soft px-3 py-2.5 text-sm text-bad"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {result?.kind === 'single' && (
        <MediaCard
          info={result.item}
          preset={preset}
          busy={busy}
          onPreset={setPreset}
          onDownload={download}
        />
      )}

      {result?.kind === 'playlist' && (
        <PlaylistPicker
          title={result.title}
          items={result.items}
          selected={selected}
          preset={preset}
          busy={busy}
          onToggle={(id) =>
            setSelected((current) => {
              const next = new Set(current)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          }
          onToggleAll={() =>
            setSelected((current) =>
              current.size === result.items.length
                ? new Set()
                : new Set(result.items.map((item) => item.id)),
            )
          }
          onPreset={setPreset}
          onDownload={download}
        />
      )}

      <JobList
        jobs={state.jobs}
        outputDir={state.outputDir}
        onCancel={(id) => void api.cancel(id)}
        onClear={() => void api.clearFinished()}
        onReveal={() => void api.reveal()}
      />

      <footer className="mt-auto border-t border-line pt-5 text-[13px] text-ink-3">
        Downloading is up to you and the terms of whatever you download from. This only drives
        yt-dlp, which has to be installed separately.
      </footer>
    </div>
  )
}
