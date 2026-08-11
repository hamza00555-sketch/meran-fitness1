// ── Verified blob storage ─────────────────────────────────────
// Nothing reaches the database unverified. A file whose bytes do
// not hash to the SHA-256 the manifest promised is dropped on the
// floor and re-queued, so a truncated or tampered response can
// never end up rendered as an icon.

import {
  getBlobRec, putBlobRec, delBlobRec, allShas, countBlobs,
  getAllBlobRecs, getMeta, putMeta, clearAll, idbAvailable,
} from './idb.js'
import { parseManifest } from './manifest.js'

// crypto.subtle only exists in a secure context. localhost counts;
// `vite --host` on a LAN IP over plain HTTP does not — which is
// exactly how you test on a phone. Degrade there instead of dying.
export const canHash = () => {
  try { return typeof crypto !== 'undefined' && !!crypto.subtle } catch { return false }
}

export async function sha256Hex(buf) {
  const digest = await crypto.subtle.digest('SHA-256', buf)
  const bytes = new Uint8Array(digest)
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0')
  return out
}

export class IntegrityError extends Error {
  constructor(expected, actual) {
    super('integrity-mismatch')
    this.name = 'IntegrityError'
    this.expected = expected
    this.actual = actual
  }
}

/**
 * Verifies bytes against the manifest's hash and stores them.
 * Returns { sha, bytes, verified }. Throws IntegrityError on mismatch
 * — before anything is written.
 */
export async function verifyAndStore(asset, arrayBuffer, type = 'image/webp') {
  const size = arrayBuffer.byteLength

  if (canHash()) {
    const actual = await sha256Hex(arrayBuffer)
    if (actual !== asset.sha256) throw new IntegrityError(asset.sha256, actual)
  } else {
    // No hashing available: the best remaining checks are the declared
    // length and whether the bytes actually decode as an image. Weaker
    // than SHA-256, and the UI says so.
    if (asset.bytes && size !== asset.bytes) throw new IntegrityError(asset.sha256, `bytes:${size}`)
    if (typeof createImageBitmap === 'function') {
      try {
        const bmp = await createImageBitmap(new Blob([arrayBuffer], { type }))
        bmp.close?.()
      } catch { throw new IntegrityError(asset.sha256, 'undecodable') }
    }
  }

  const rec = {
    sha: asset.sha256,
    blob: new Blob([arrayBuffer], { type }),
    bytes: size,
    at: Date.now(),
  }
  await putBlobRec(rec)
  return { sha: asset.sha256, bytes: size, verified: canHash() }
}

export const hasBlob = async (sha) => {
  try { return !!(await getBlobRec(sha)) } catch { return false }
}

/** Which of these hashes are already on disk — the resume predicate. */
export async function storedShas() {
  try { return new Set(await allShas()) } catch { return new Set() }
}

/** Drops every blob the manifest no longer references. */
export async function collectGarbage(manifest) {
  const keep = new Set(manifest.assets.map(a => a.sha256))
  const have = await storedShas()
  const doomed = [...have].filter(sha => !keep.has(sha))
  for (const sha of doomed) { try { await delBlobRec(sha) } catch {} }
  return doomed.length
}

// A manifest goes into IndexedDB as plain data — the structured clone
// drops the lookup Maps parseManifest builds. Re-parsing on the way out
// means callers always get the same shape whether it came from the
// network or from disk.
export const readManifest = async () => {
  const raw = await getMeta('manifest')
  if (!raw) return undefined
  try { return parseManifest(raw) } catch { return undefined }
}
export const writeManifest   = (m) => putMeta('manifest', m)
export const readInstalled   = () => getMeta('installed')
export const writeInstalled  = (v) => putMeta('installed', v)

/**
 * The truth about what is installed, read from the blobs themselves.
 *
 * The localStorage pointer is a hint, never the answer: iOS evicts
 * script-writable storage as a unit and fires no event, so a pointer
 * saying "installed" alongside an empty database is a real state the
 * app has to recover from rather than trust.
 */
export async function reconcile() {
  if (!idbAvailable()) return { installed: false, reason: 'no-idb', manifest: null, count: 0 }
  try {
    const [manifest, count] = await Promise.all([readManifest(), countBlobs()])
    if (!manifest || !count) return { installed: false, reason: 'empty', manifest: manifest || null, count }
    const have = await storedShas()
    const missing = manifest.assets.filter(a => !have.has(a.sha256))
    return {
      installed: missing.length === 0,
      reason: missing.length ? 'partial' : 'ok',
      manifest, count, missing,
    }
  } catch (e) {
    return { installed: false, reason: 'error', error: e, manifest: null, count: 0 }
  }
}

/** Every stored blob, for building object URLs in one pass at boot. */
export async function loadAllBlobs() {
  try {
    const recs = await getAllBlobRecs()
    const map = new Map()
    for (const r of recs) if (r && r.blob) map.set(r.sha, r.blob)
    return map
  } catch { return new Map() }
}

export const wipe = () => clearAll()

/** Is there room? Refusing up front beats failing halfway through. */
export async function hasRoomFor(bytes) {
  try {
    if (!navigator.storage?.estimate) return true
    const { quota = 0, usage = 0 } = await navigator.storage.estimate()
    if (!quota) return true
    return quota - usage > bytes * 1.5
  } catch { return true }
}

export async function requestPersistence() {
  // iOS never grants this. Asking is free; relying on it is not.
  try { return !!(await navigator.storage?.persist?.()) } catch { return false }
}
