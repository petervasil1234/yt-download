import type { MediaInfo, Preset } from '#shared/types.ts'
import { PRESET_LABELS, PRESET_ORDER, minHeightFor } from '@/lib/presets'
import { bytes } from '@/lib/format'
import { cn } from '@/lib/utils'

type Props = {
  /** Estimates and max height come from the probe; null for playlists, which are not probed deeply. */
  info: MediaInfo | null
  value: Preset
  onChange: (preset: Preset) => void
}

export function PresetPicker({ info, value, onChange }: Props) {
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="eyebrow mb-1 p-0">Quality</legend>
      <div className="flex flex-wrap gap-2">
        {PRESET_ORDER.map((preset) => {
          const needed = minHeightFor(preset)
          // A 240p video cannot be downloaded at 1080p; offering it would only produce a surprise.
          const unavailable = info !== null && needed > 0 && info.maxHeight < needed
          const estimate = info?.estimates[preset] ?? null

          return (
            <button
              key={preset}
              type="button"
              disabled={unavailable}
              aria-pressed={value === preset}
              onClick={() => onChange(preset)}
              className={cn(
                'rounded-lg border px-3 py-2 text-left transition-colors',
                value === preset
                  ? 'border-brand bg-brand-soft'
                  : 'border-line bg-surface hover:bg-surface-2',
                unavailable && 'cursor-not-allowed opacity-40 hover:bg-surface',
              )}
            >
              <span className="block text-sm font-medium text-ink">{PRESET_LABELS[preset]}</span>
              <span className="block font-mono text-[11px] text-ink-3">
                {unavailable ? 'not offered' : info ? `≈ ${bytes(estimate)}` : 'size unknown'}
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
