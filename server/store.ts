import { createClient, type Client } from '@libsql/client'
import fs from 'node:fs'
import path from 'node:path'

const KEY = 'app-snapshot'

let client: Client | undefined

function tursoUrl(): string {
  return process.env.TURSO_DATABASE_URL ?? ''
}

function getClient(): Client {
  if (!client) {
    client = createClient({
      url: tursoUrl(),
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  }
  return client
}

function filePath(): string {
  return path.join(process.cwd(), 'data', 'snapshot.json')
}

export async function ensureStore(): Promise<void> {
  if (tursoUrl()) {
    await getClient().execute(`
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    return
  }
  const dir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

export async function readSnapshot(): Promise<unknown | null> {
  if (tursoUrl()) {
    const result = await getClient().execute({
      sql: 'SELECT value FROM kv WHERE key = ?',
      args: [KEY],
    })
    const value = result.rows[0]?.value
    if (typeof value !== 'string') return null
    return JSON.parse(value) as unknown
  }
  if (!fs.existsSync(filePath())) return null
  return JSON.parse(fs.readFileSync(filePath(), 'utf8')) as unknown
}

export async function writeSnapshot(data: unknown): Promise<void> {
  const json = JSON.stringify(data)
  const now = new Date().toISOString()
  if (tursoUrl()) {
    await getClient().execute({
      sql: `INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
              value = excluded.value,
              updated_at = excluded.updated_at`,
      args: [KEY, json, now],
    })
    return
  }
  fs.writeFileSync(filePath(), json)
}
