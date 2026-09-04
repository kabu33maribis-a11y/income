import fs from 'node:fs'
import path from 'node:path'
import {
  ensureTurso,
  hasTurso,
  readTursoSnapshot,
  writeTursoSnapshot,
} from './turso.ts'

function filePath(): string {
  return path.join(process.cwd(), 'data', 'snapshot.json')
}

export async function ensureStore(): Promise<void> {
  if (hasTurso()) {
    await ensureTurso()
    return
  }
  const dir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

export async function readSnapshot(): Promise<unknown | null> {
  if (hasTurso()) return readTursoSnapshot()
  if (!fs.existsSync(filePath())) return null
  return JSON.parse(fs.readFileSync(filePath(), 'utf8')) as unknown
}

export async function writeSnapshot(data: unknown): Promise<void> {
  if (hasTurso()) {
    await writeTursoSnapshot(data)
    return
  }
  fs.writeFileSync(filePath(), JSON.stringify(data))
}
