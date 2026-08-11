import { homedir } from 'node:os'
import { resolve } from 'node:path'

export type Config = {
  port: number
  host: string
  outputDir: string
  /** Serve the built UI from dist/ as well as the API. Off while Vite is doing that job. */
  serveStatic: boolean
}

/**
 * Reads configuration from flags, then the environment, then defaults.
 *
 * The host defaults to loopback deliberately. This server spawns processes and writes files, so
 * binding it to every interface hands that to anyone on the same network — worth having to ask for.
 */
export function readConfig(argv: string[] = process.argv.slice(2)): Config {
  return {
    port: Number(flag(argv, '--port') ?? process.env.PORT ?? 5175),
    host: flag(argv, '--host') ?? process.env.HOST ?? '127.0.0.1',
    outputDir: resolve(
      expandHome(flag(argv, '--dir') ?? process.env.OUTPUT_DIR ?? '~/Downloads'),
    ),
    serveStatic: !argv.includes('--api-only'),
  }
}

function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name)
  if (index !== -1 && argv[index + 1] !== undefined) return argv[index + 1]

  const inline = argv.find((arg) => arg.startsWith(`${name}=`))
  return inline?.slice(name.length + 1)
}

function expandHome(path: string): string {
  return path.startsWith('~') ? path.replace('~', homedir()) : path
}
