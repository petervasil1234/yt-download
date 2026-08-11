import type { Job, Preset, ProbeResult } from '#shared/types.ts'

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })

  const data: unknown = await res.json().catch(() => null)

  if (!res.ok) {
    const message =
      data !== null && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`
    throw new Error(message)
  }

  return data as T
}

export function probe(url: string): Promise<ProbeResult> {
  return post<ProbeResult>('/api/probe', { url })
}

export function enqueue(
  items: { url: string; title: string }[],
  preset: Preset,
): Promise<{ jobs: Job[] }> {
  return post<{ jobs: Job[] }>('/api/jobs', { items, preset })
}

export function cancel(id: string): Promise<unknown> {
  return post(`/api/jobs/${id}/cancel`)
}

export function clearFinished(): Promise<unknown> {
  return post('/api/clear')
}

export function reveal(): Promise<unknown> {
  return post('/api/reveal')
}
