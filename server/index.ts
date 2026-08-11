import { spawn } from 'node:child_process'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readConfig } from './config.ts'
import { json, readJson, serveStatic } from './http.ts'
import { PRESETS } from './formats.ts'
import { Queue, type JobRequest } from './queue.ts'
import { checkTools, makeRunner, probe } from './ytdlp.ts'
import type { Preset, ServerState } from '../shared/types.ts'

const config = readConfig()
const distRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

mkdirSync(config.outputDir, { recursive: true })

let tools = { ytdlp: null as string | null, ffmpeg: null as string | null }
const listeners = new Set<ServerResponse>()
const queue = new Queue(makeRunner({ outputDir: () => config.outputDir }), broadcast)

function state(): ServerState {
  return { jobs: queue.list(), tools, outputDir: config.outputDir }
}

function broadcast(): void {
  const frame = `data: ${JSON.stringify(state())}\n\n`
  for (const res of listeners) res.write(frame)
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const path = url.pathname

  if (!path.startsWith('/api/')) {
    if (config.serveStatic) serveStatic(distRoot, path, res)
    else json(res, 404, { error: 'Not found' })
    return
  }

  void handleApi(req.method ?? 'GET', path, req, res).catch((error: unknown) => {
    if (!res.headersSent) {
      json(res, 400, { error: error instanceof Error ? error.message : 'Request failed' })
    }
  })
})

async function handleApi(
  method: string,
  path: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (method === 'GET' && path === '/api/state') {
    json(res, 200, state())
    return
  }

  if (method === 'GET' && path === '/api/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    })
    res.write(`data: ${JSON.stringify(state())}\n\n`)

    listeners.add(res)
    req.on('close', () => listeners.delete(res))
    return
  }

  if (method === 'POST' && path === '/api/probe') {
    const body = await readJson(req)
    const url = String(body.url ?? '').trim()
    if (url === '') throw new Error('Paste a link first.')

    json(res, 200, await probe(url))
    return
  }

  if (method === 'POST' && path === '/api/jobs') {
    const body = await readJson(req)
    const preset = asPreset(body.preset)
    const items = Array.isArray(body.items) ? body.items : []

    const requests: JobRequest[] = items.flatMap((item) => {
      const record = item as Record<string, unknown>
      const url = String(record.url ?? '').trim()
      if (url === '') return []
      return [{ url, title: String(record.title ?? url), preset }]
    })

    if (requests.length === 0) throw new Error('Nothing to download.')

    json(res, 200, { jobs: queue.add(requests) })
    return
  }

  if (method === 'POST' && path.startsWith('/api/jobs/') && path.endsWith('/cancel')) {
    const id = path.slice('/api/jobs/'.length, -'/cancel'.length)
    json(res, 200, { cancelled: queue.cancel(id) })
    return
  }

  if (method === 'POST' && path === '/api/clear') {
    queue.clearFinished()
    json(res, 200, { ok: true })
    return
  }

  if (method === 'POST' && path === '/api/reveal') {
    // Opens only the configured output directory — never a path the client supplies, which would
    // hand arbitrary "open anything" to whoever can reach this server.
    spawn(revealCommand(), [config.outputDir], { detached: true, stdio: 'ignore' }).unref()
    json(res, 200, { ok: true })
    return
  }

  json(res, 404, { error: 'Not found' })
}

function asPreset(value: unknown): Preset {
  const preset = String(value ?? '')
  if (!PRESETS.includes(preset as Preset)) throw new Error(`Unknown quality: ${preset}`)
  return preset as Preset
}

function revealCommand(): string {
  if (process.platform === 'darwin') return 'open'
  return process.platform === 'win32' ? 'explorer' : 'xdg-open'
}

const shutdown = () => {
  for (const res of listeners) res.end()
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

checkTools()
  .then((found) => {
    tools = found
    broadcast()

    if (!found.ytdlp) console.warn('yt-dlp not found — install it with: brew install yt-dlp')
    if (!found.ffmpeg) console.warn('ffmpeg not found — install it with: brew install ffmpeg')
  })
  .catch(() => {
    /* checkTools never rejects in practice; the UI reports the nulls either way. */
  })

server.listen(config.port, config.host, () => {
  console.log(`yt-download API on http://${config.host}:${config.port}`)
  console.log(`saving into ${config.outputDir}`)
  if (config.host === '0.0.0.0') {
    console.warn('Bound to every interface — anyone on this network can queue downloads.')
  }
})
