const KEY = 'app-snapshot'

type HranaValue =
  | { type: 'null' }
  | { type: 'text'; value: string }
  | { type: 'integer'; value: string }
  | { type: 'float'; value: number }

type HranaResult = {
  results?: Array<{
    type?: string
    error?: { message?: string }
    response?: { result?: { rows?: HranaValue[][] } }
  }>
}

export function hasTurso(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN)
}

function httpUrl(): string {
  const raw = process.env.TURSO_DATABASE_URL ?? ''
  return raw.replace(/^libsql:\/\//, 'https://').replace(/\/$/, '')
}

function toArg(value: string): HranaValue {
  return { type: 'text', value }
}

function fromCell(cell: HranaValue | undefined): unknown {
  if (!cell || cell.type === 'null') return null
  if (cell.type === 'text') return cell.value
  if (cell.type === 'integer' || cell.type === 'float') return cell.value
  return null
}

async function execute(
  sql: string,
  args: string[] = [],
): Promise<HranaValue[][]> {
  const res = await fetch(`${httpUrl()}/v2/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.TURSO_AUTH_TOKEN ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          type: 'execute',
          stmt: {
            sql,
            args: args.map(toArg),
            want_rows: true,
          },
        },
        { type: 'close' },
      ],
    }),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Turso ${res.status}: ${text.slice(0, 200)}`)
  }
  const body = JSON.parse(text) as HranaResult
  const first = body.results?.[0]
  if (first?.type === 'error') {
    throw new Error(first.error?.message ?? 'Turso execute error')
  }
  return first?.response?.result?.rows ?? []
}

export async function ensureTurso(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
}

export async function readTursoSnapshot(): Promise<unknown | null> {
  const rows = await execute('SELECT value FROM kv WHERE key = ?', [KEY])
  const value = fromCell(rows[0]?.[0])
  if (typeof value !== 'string') return null
  return JSON.parse(value) as unknown
}

export async function writeTursoSnapshot(data: unknown): Promise<void> {
  await execute(
    `INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
    [KEY, JSON.stringify(data), new Date().toISOString()],
  )
}
