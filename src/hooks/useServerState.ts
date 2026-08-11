import { useEffect, useState } from 'react'
import type { ServerState } from '#shared/types.ts'

const EMPTY: ServerState = { jobs: [], tools: { ytdlp: null, ffmpeg: null }, outputDir: '' }

/**
 * Mirrors the server's state over server-sent events.
 *
 * SSE rather than polling because the server knows exactly when something changed, and rather than
 * WebSockets because nothing ever needs to travel the other way — commands go over plain POSTs.
 */
export function useServerState(): { state: ServerState; connected: boolean } {
  const [state, setState] = useState<ServerState>(EMPTY)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const source = new EventSource('/api/events')

    source.onopen = () => setConnected(true)
    source.onmessage = (event) => {
      setState(JSON.parse(event.data as string) as ServerState)
    }
    // EventSource reconnects on its own; this only reflects that in the UI.
    source.onerror = () => setConnected(false)

    return () => source.close()
  }, [])

  return { state, connected }
}
