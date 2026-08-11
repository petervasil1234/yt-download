import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PresetPicker } from '@/components/PresetPicker'
import { duration } from '@/lib/format'
import type { MediaInfo, Preset } from '#shared/types.ts'

type Props = {
  info: MediaInfo
  preset: Preset
  busy: boolean
  onPreset: (preset: Preset) => void
  onDownload: () => void
}

export function MediaCard({ info, preset, busy, onPreset, onDownload }: Props) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex gap-4">
        <Thumbnail url={info.thumbnail} />
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-base leading-snug font-semibold text-ink">{info.title}</h2>
          <p className="m-0 text-[13px] text-ink-3">
            {duration(info.duration)}
            {info.channel !== '' && ` · ${info.channel}`}
          </p>
        </div>
      </div>

      <PresetPicker info={info} value={preset} onChange={onPreset} />

      <div>
        <Button onClick={onDownload} disabled={busy}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          Download
        </Button>
      </div>
    </div>
  )
}

export function Thumbnail({ url, small }: { url: string | null; small?: boolean }) {
  const size = small ? 'h-9 w-16' : 'h-[68px] w-[120px]'

  if (url === null) {
    return <div className={`${size} shrink-0 rounded-md bg-surface-2`} aria-hidden />
  }

  return (
    <img
      src={url}
      alt=""
      className={`${size} shrink-0 rounded-md bg-surface-2 object-cover`}
      loading="lazy"
    />
  )
}
