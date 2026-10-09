// ── IndexedDB, the thinnest wrapper that does the job ─────────
// The icon pack is binary and can run to a few megabytes, which
// rules out localStorage (and `ls.set` swallows QuotaExceededError,
// so a pack stored there would look saved and simply not be).
//
// Two stores:
//   blobs — keyed by the file's SHA-256. Content-addressed, so a
//           changed icon is a different key and nothing needs
//           migrating when the pack version moves.
//   meta  — the manifest itself and the installed-pack record, kept
//           in the same database as the blobs they describe so the
//           two can never disagree about what is installed.
//
// The database name is deliberately NOT namespaced per user: the
// pack is a property of the device, and making each profile
// re-download the same bytes would be silly.

const DB_NAME = 'meran-assets'
const DB_VERSION = 1
export const BLOBS = 'blobs'
export const META  = 'meta'

let dbPromise = null

export const idbAvailable = () => {
  try { return typeof indexedDB !== 'undefined' && indexedDB !== null } catch { return false }
}

export function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (!idbAvailable()) { reject(new Error('indexeddb-unavailable')); return }
    let req
    try { req = indexedDB.open(DB_NAME, DB_VERSION) } catch (e) { reject(e); return }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS, { keyPath: 'sha' })
      if (!db.objectStoreNames.contains(META))  db.createObjectStore(META,  { keyPath: 'k' })
    }
    req.onsuccess = () => {
      const db = req.result
      // Another tab upgrading the schema would otherwise block forever.
      db.onversionchange = () => { try { db.close() } catch {} ; dbPromise = null }
      resolve(db)
    }
    req.onerror   = () => reject(req.error || new Error('indexeddb-open-failed'))
    req.onblocked = () => reject(new Error('indexeddb-blocked'))
  })
  // A failed open must not be cached, or a transient failure would
  // permanently disable the pack for the rest of the session.
  dbPromise.catch(() => { dbPromise = null })
  return dbPromise
}

const run = (store, mode, fn) => openDB().then(db => new Promise((resolve, reject) => {
  let tx
  try { tx = db.transaction(store, mode) } catch (e) { reject(e); return }
  const req = fn(tx.objectStore(store))
  tx.onabort = () => reject(tx.error || new Error('idb-abort'))
  tx.onerror = () => reject(tx.error || new Error('idb-error'))
  if (req) {
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  } else {
    tx.oncomplete = () => resolve()
  }
}))

export const getMeta = (k)   => run(META,  'readonly',  s => s.get(k)).then(r => r ? r.value : undefined)
export const putMeta = (k, value) => run(META, 'readwrite', s => s.put({ k, value }))
export const delMeta = (k)   => run(META,  'readwrite', s => s.delete(k))

export const getBlobRec = (sha) => run(BLOBS, 'readonly', s => s.get(sha))
// One transaction per file, committed the moment it verifies. Batching
// would mean a mid-download kill loses everything downloaded so far.
export const putBlobRec = (rec) => run(BLOBS, 'readwrite', s => s.put(rec))
export const delBlobRec = (sha) => run(BLOBS, 'readwrite', s => s.delete(sha))

// Keys only — never load every blob into memory just to see what's there.
export const allShas = () => run(BLOBS, 'readonly', s => s.getAllKeys()).then(k => k || [])

export const countBlobs = () => run(BLOBS, 'readonly', s => s.count()).then(n => n || 0)

export const getAllBlobRecs = () => run(BLOBS, 'readonly', s => s.getAll()).then(r => r || [])

export async function clearAll() {
  const db = await openDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction([BLOBS, META], 'readwrite')
    tx.objectStore(BLOBS).clear()
    tx.objectStore(META).clear()
    tx.oncomplete = resolve
    tx.onabort = tx.onerror = () => reject(tx.error || new Error('idb-clear-failed'))
  })
}

// Test seam: lets specs start from a clean module state.
export const __resetForTests = () => { dbPromise = null }
