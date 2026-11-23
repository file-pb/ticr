/** Export a import pokroku jako jeden JSON soubor. */
import { attempts, progress } from './db'
import type { Attempt, Progress } from '../domain/types'

export interface Snapshot {
  format: 'ticr-pokrok'
  schemaVersion: 1
  exportedAt: string
  attempts: Attempt[]
  progress: Progress[]
}

export async function exportSnapshot(): Promise<Snapshot> {
  return {
    format: 'ticr-pokrok',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    attempts: await attempts.all(),
    progress: await progress.all(),
  }
}

export function parseSnapshot(raw: string): Snapshot {
  const data = JSON.parse(raw) as Partial<Snapshot>
  if (data.format !== 'ticr-pokrok' || data.schemaVersion !== 1) {
    throw new Error('Tohle není export pokroku z této aplikace.')
  }
  if (!Array.isArray(data.attempts) || !Array.isArray(data.progress)) {
    throw new Error('Export je poškozený — chybí pokusy nebo pokrok.')
  }
  return data as Snapshot
}

/** Import přidává a přepisuje podle ID; nic jiného nemaže. */
export async function importSnapshot(snapshot: Snapshot): Promise<{ attempts: number; progress: number }> {
  for (const a of snapshot.attempts) await attempts.put(a)
  for (const p of snapshot.progress) await progress.put(p)
  return { attempts: snapshot.attempts.length, progress: snapshot.progress.length }
}

export function downloadSnapshot(snapshot: Snapshot): void {
  const blob = new Blob([JSON.stringify(snapshot, null, 1)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ticr-pokrok-${snapshot.exportedAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
