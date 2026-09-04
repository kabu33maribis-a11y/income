import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { ensureStore, readSnapshot, writeSnapshot } from './server/store.ts'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function snapshotApi() {
  return {
    name: 'snapshot-api',
    configureServer(server: {
      middlewares: {
        use: (
          fn: (
            req: IncomingMessage,
            res: ServerResponse,
            next: () => void,
          ) => void,
        ) => void
      }
    }) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url !== '/api/data') {
          next()
          return
        }
        void (async () => {
          await ensureStore()
          if (req.method === 'GET') {
            const data = await readSnapshot()
            sendJson(res, 200, data ?? { empty: true })
            return
          }
          if (req.method === 'PUT') {
            const raw = await readBody(req)
            const parsed = JSON.parse(raw) as unknown
            if (
              !parsed ||
              typeof parsed !== 'object' ||
              (parsed as { version?: unknown }).version !== 2
            ) {
              sendJson(res, 400, { error: 'invalid snapshot' })
              return
            }
            await writeSnapshot(parsed)
            sendJson(res, 200, { ok: true })
            return
          }
          sendJson(res, 405, { error: 'method not allowed' })
        })().catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : 'store error'
          sendJson(res, 500, { error: message })
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (env.TURSO_DATABASE_URL) {
    process.env.TURSO_DATABASE_URL = env.TURSO_DATABASE_URL
  }
  if (env.TURSO_AUTH_TOKEN) {
    process.env.TURSO_AUTH_TOKEN = env.TURSO_AUTH_TOKEN
  }

  return {
    plugins: [react(), snapshotApi()],
  }
})
