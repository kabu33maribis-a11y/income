import {
  isAppSnapshot,
  readFullSnapshot,
  snapshotHasData,
  writeFullSnapshot,
} from './storage'
import type { AppSnapshot } from './types'

export type SyncStatus = 'loading' | 'saving' | 'saved' | 'local' | 'error'

export type HydrateResult = {
  snapshot: AppSnapshot
  source: 'remote' | 'seeded' | 'local'
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

export async function fetchRemoteSnapshot(): Promise<AppSnapshot | null> {
  try {
    const res = await fetch('/api/data')
    if (!res.ok) return null
    const data: unknown = await res.json()
    if (!isAppSnapshot(data)) return null
    return data
  } catch {
    return null
  }
}

export async function pushSnapshot(snapshot: AppSnapshot): Promise<boolean> {
  try {
    const res = await fetch('/api/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function hydrateApp(): Promise<HydrateResult> {
  const local = readFullSnapshot()
  const remote = await fetchRemoteSnapshot()
  if (remote) {
    writeFullSnapshot(remote)
    return { snapshot: remote, source: 'remote' }
  }
  if (snapshotHasData(local)) {
    const ok = await pushSnapshot(local)
    return { snapshot: local, source: ok ? 'seeded' : 'local' }
  }
  return { snapshot: local, source: 'local' }
}

export function queueCloudSave(
  onStatus: (status: SyncStatus) => void,
): void {
  onStatus('saving')
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    const ok = await pushSnapshot(readFullSnapshot())
    onStatus(ok ? 'saved' : 'error')
  }, 800)
}
