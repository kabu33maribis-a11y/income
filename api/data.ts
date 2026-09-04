import {
  ensureTurso,
  hasTurso,
  readTursoSnapshot,
  writeTursoSnapshot,
} from '../server/turso'

export const config = {
  runtime: 'edge',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function isSnapshot(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false
  const o = v as { version?: unknown; private?: unknown; stock?: unknown }
  return o.version === 2 && !!o.private && !!o.stock
}

export default async function handler(req: Request): Promise<Response> {
  try {
    if (!hasTurso()) {
      if (req.method === 'GET') return json(200, { empty: true })
      return json(503, { error: 'turso is not configured' })
    }
    await ensureTurso()
    if (req.method === 'GET') {
      const data = await readTursoSnapshot()
      return json(200, data ?? { empty: true })
    }
    if (req.method === 'PUT') {
      const parsed: unknown = await req.json()
      if (!isSnapshot(parsed)) return json(400, { error: 'invalid snapshot' })
      await writeTursoSnapshot(parsed)
      return json(200, { ok: true })
    }
    return json(405, { error: 'method not allowed' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'store error'
    return json(500, { error: message })
  }
}
