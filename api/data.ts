import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ensureStore, readSnapshot, writeSnapshot } from '../server/store'

function isSnapshot(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false
  const o = v as { version?: unknown; private?: unknown; stock?: unknown }
  return o.version === 2 && !!o.private && !!o.stock
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  try {
    await ensureStore()
    if (req.method === 'GET') {
      const data = await readSnapshot()
      res.status(200).json(data ?? { empty: true })
      return
    }
    if (req.method === 'PUT') {
      if (!isSnapshot(req.body)) {
        res.status(400).json({ error: 'invalid snapshot' })
        return
      }
      await writeSnapshot(req.body)
      res.status(200).json({ ok: true })
      return
    }
    res.status(405).json({ error: 'method not allowed' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'store error'
    res.status(500).json({ error: message })
  }
}
