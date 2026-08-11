export function bytes(value: number | null): string {
  if (value === null || value <= 0) return 'unknown size'
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} kB`
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function duration(seconds: number): string {
  if (seconds <= 0) return 'live'

  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`
}

/** Last path segment — the queue shows the file name, not the whole absolute path. */
export function fileName(path: string): string {
  return path.split('/').pop() ?? path
}
