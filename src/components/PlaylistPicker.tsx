import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { PresetPicker } from '@/components/PresetPicker'
import { Thumbnail } from '@/components/MediaCard'
import { duration } from '@/lib/format'
import type { MediaInfo, Preset } from '#shared/types.ts'

type Props = {
  title: string
  items: MediaInfo[]
  selected: Set<string>
  preset: Preset
  busy: boolean
  onToggle: (id: string) => void
  onToggleAll: () => void
  onPreset: (preset: Preset) => void
  onDownload: () => void
}

export function PlaylistPicker({
  title,
  items,
  selected,
  preset,
  busy,
  onToggle,
  onToggleAll,
  onPreset,
  onDownload,
}: Props) {
  const allSelected = selected.size === items.length && items.length > 0

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-base font-semibold text-ink">{title}</h2>
        <span className="font-mono text-[11px] text-ink-3">
          {selected.size} of {items.length} selected
        </span>
      </div>

      {/*
        Playlist entries come from a flat listing, which carries no format information — so quality
        is chosen once for the whole batch and no per-item size estimate can be shown.
      */}
      <PresetPicker info={null} value={preset} onChange={onPreset} />

      <div className="flex items-center gap-2.5 border-y border-line py-2">
        <Checkbox
          id="all"
          checked={allSelected}
          onCheckedChange={onToggleAll}
          aria-label="Select all"
        />
        <label htmlFor="all" className="text-[13px] text-ink-2">
          {allSelected ? 'Deselect all' : 'Select all'}
        </label>
      </div>

      <ul className="m-0 flex max-h-96 list-none flex-col gap-1 overflow-y-auto p-0">
        {items.map((item) => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 hover:bg-surface-2">
              <Checkbox
                checked={selected.has(item.id)}
                onCheckedChange={() => onToggle(item.id)}
              />
              <Thumbnail url={item.thumbnail} small />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{item.title}</span>
                <span className="block font-mono text-[11px] text-ink-3">
                  {duration(item.duration)}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div>
        <Button onClick={onDownload} disabled={busy || selected.size === 0}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          Download {selected.size === 1 ? '1 video' : `${selected.size} videos`}
        </Button>
      </div>
    </div>
  )
}
