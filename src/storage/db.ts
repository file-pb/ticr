/**
 * Pokrok a historie v IndexedDB prohlížeče. Žádný server, žádný účet.
 * Jediný autoritativní stav je u člověka, který se učí.
 */
import type { Attempt, Progress } from '../domain/types'

const DB_NAME = 'ticr'
const DB_VERSION = 1
const STORE_ATTEMPTS = 'attempts'
const STORE_PROGRESS = 'progress'
const STORE_META = 'meta'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_ATTEMPTS)) {
        db.createObjectStore(STORE_ATTEMPTS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
        db.createObjectStore(STORE_PROGRESS, { keyPath: 'questionId' })
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = fn(t.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        t.oncomplete = () => db.close()
      }),
  )
}

export const attempts = {
  put: (a: Attempt) => tx(STORE_ATTEMPTS, 'readwrite', (s) => s.put(a) as IDBRequest<IDBValidKey>),
  get: (id: string) => tx<Attempt | undefined>(STORE_ATTEMPTS, 'readonly', (s) => s.get(id)),
  all: () =>
    tx<Attempt[]>(STORE_ATTEMPTS, 'readonly', (s) => s.getAll()).then((xs) =>
      xs.sort((a, b) => b.createdAt - a.createdAt),
    ),
  remove: (id: string) => tx(STORE_ATTEMPTS, 'readwrite', (s) => s.delete(id) as IDBRequest<undefined>),
}

export const progress = {
  put: (p: Progress) => tx(STORE_PROGRESS, 'readwrite', (s) => s.put(p) as IDBRequest<IDBValidKey>),
  all: () => tx<Progress[]>(STORE_PROGRESS, 'readonly', (s) => s.getAll()),
}

export const meta = {
  set: (key: string, value: unknown) =>
    tx(STORE_META, 'readwrite', (s) => s.put(value, key) as IDBRequest<IDBValidKey>),
  get: <T>(key: string) => tx<T | undefined>(STORE_META, 'readonly', (s) => s.get(key)),
}

/** Vymazání historie. Nevratné, proto se na to v rozhraní ptá potvrzení. */
export async function wipe(): Promise<void> {
  const db = await open()
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([STORE_ATTEMPTS, STORE_PROGRESS, STORE_META], 'readwrite')
    t.objectStore(STORE_ATTEMPTS).clear()
    t.objectStore(STORE_PROGRESS).clear()
    t.objectStore(STORE_META).clear()
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
  db.close()
}
