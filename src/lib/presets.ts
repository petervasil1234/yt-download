import type { Preset } from '#shared/types.ts'

export const PRESET_ORDER: Preset[] = ['best', '1080p', '720p', '480p', 'audio']

export const PRESET_LABELS: Record<Preset, string> = {
  best: 'Best available',
  '1080p': '1080p',
  '720p': '720p',
  '480p': '480p',
  audio: 'Audio only',
}

/** Height a source must reach for the preset to make sense; 0 when it always does. */
export function minHeightFor(preset: Preset): number {
  if (preset === '1080p') return 1080
  if (preset === '720p') return 720
  if (preset === '480p') return 480
  return 0
}
