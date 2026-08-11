import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

export function json(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
  })
  res.end(text)
}

export async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of req) {
    size += (chunk as Buffer).length
    // A URL and a preset; anything larger is not a request this server has any use for.
    if (size > 64 * 1024) throw new Error('Request body too large.')
    chunks.push(chunk as Buffer)
  }

  if (chunks.length === 0) return {}

  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString())
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    throw new Error('Request body is not valid JSON.')
  }
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
}

/**
 * Serves the built UI, falling back to index.html so client-side routes survive a refresh.
 *
 * `normalize` on the joined path is what stops `../` from walking out of dist — without it any
 * client could read arbitrary files, which matters the moment --host is used.
 */
export function serveStatic(root: string, urlPath: string, res: ServerResponse): void {
  const target = normalize(join(root, decodeURIComponent(urlPath)))

  if (!target.startsWith(root)) {
    json(res, 403, { error: 'Forbidden' })
    return
  }

  const file =
    existsSync(target) && statSync(target).isFile() ? target : join(root, 'index.html')

  if (!existsSync(file)) {
    json(res, 404, { error: 'The UI is not built. Run npm run build first.' })
    return
  }

  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
  createReadStream(file).pipe(res)
}
