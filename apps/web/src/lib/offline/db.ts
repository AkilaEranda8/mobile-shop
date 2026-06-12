import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export type OfflineOpType = 'SALE_CREATE'

export interface OfflineQueueItem {
  id: string
  type: OfflineOpType
  payload: Record<string, unknown>
  createdAt: string
  label?: string
}

interface HexOfflineDB extends DBSchema {
  queue: {
    key: string
    value: OfflineQueueItem
    indexes: { 'by-created': string }
  }
  meta: {
    key: string
    value: { key: string; value: unknown; updatedAt: string }
  }
}

const DB_NAME = 'hexalyte-offline'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<HexOfflineDB>> | null = null

function getDb(): Promise<IDBPDatabase<HexOfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<HexOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const queue = db.createObjectStore('queue', { keyPath: 'id' })
        queue.createIndex('by-created', 'createdAt')
        db.createObjectStore('meta', { keyPath: 'key' })
      },
    })
  }
  return dbPromise
}

export async function addQueueItem(item: OfflineQueueItem): Promise<void> {
  const db = await getDb()
  await db.put('queue', item)
}

export async function getQueueItems(): Promise<OfflineQueueItem[]> {
  const db = await getDb()
  return db.getAllFromIndex('queue', 'by-created')
}

export async function removeQueueItem(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('queue', id)
}

export async function getQueueCount(): Promise<number> {
  const db = await getDb()
  return db.count('queue')
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDb()
  await db.put('meta', { key, value, updatedAt: new Date().toISOString() })
}

export async function getMeta<T>(key: string): Promise<T | null> {
  const db = await getDb()
  const row = await db.get('meta', key)
  return (row?.value as T) ?? null
}
