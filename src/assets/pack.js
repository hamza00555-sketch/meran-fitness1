// ── Pack orchestration ────────────────────────────────────────
// Boot, check, install, delete. Everything the UI touches goes
// through here; the modules underneath stay unaware of React.

import { useSyncExternalStore } from 'react'
import { ls } from '../utils.js'
import { fetchManifest } from './manifest.js'
import {
  reconcile, loadAllBlobs, collectGarbage, writeManifest, readManifest,
  wipe, canHash, requestPersistence,
} from './store.js'
import { ensureDownload, cancel as cancelDownload, isRunning } from './download.js'
import * as registry from './registry.js'

// Where the pack lives. The default is the live bucket, so a plain
// build works with no environment set; VITE_ASSETS_MANIFEST_URL
// overrides it for a staging bucket or a future custom domain.
export const MANIFEST_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ASSETS_MANIFEST_URL) ||
  'https://pub-189be0412bdd4092aa44be319badfd91.r2.dev/manifest.json'

const POINTER = 'hf_pack'          // tiny localStorage hint, never the truth
const PROMPTED = 'hf_pack_prompted'

const readPointer  = () => ls.get(POINTER, null)
const writePointer = (p) => ls.set(POINTER, p)
const clearPointer = () => ls.remove(POINTER)

export const wasPrompted = () => !!ls.get(PROMPTED, false)
export const markPrompted = () => ls.set(PROMPTED, true)

// ── React binding ─────────────────────────────────────────────
export function usePackState() {
  useSyncExternalStore(registry.subscribe, registry.getVersion, registry.getVersion)
  return registry.getPackState()
}

// ── Boot ──────────────────────────────────────────────────────
let booted = null

/**
 * Brings whatever is already on disk onto the screen, then reports
 * whether anything is missing.
 *
 * The localStorage pointer is only a hint. iOS evicts script-writable
 * storage as a unit and fires no event, so "pointer says installed,
 * database is empty" is a state that actually happens — the answer
 * always comes from counting the blobs.
 */
export function initPack() {
  if (booted) return booted
  booted = (async () => {
    if (typeof indexedDB === 'undefined') {
      registry.setPackState({ phase: 'unsupported', installed: false })
      return { installed: false, reason: 'no-idb' }
    }

    const rec = await reconcile()

    if (rec.manifest) {
      registry.applyManifest(rec.manifest)
      const blobs = await loadAllBlobs()
      registry.hydrate(rec.manifest, blobs)
    }

    if (rec.installed) {
      const pointer = readPointer()
      if (!pointer || pointer.packVersion !== rec.manifest.packVersion) {
        writePointer({
          v: 1, packVersion: rec.manifest.packVersion,
          installedAt: Date.now(), count: rec.manifest.assets.length,
        })
      }
      registry.setPackState({
        phase: 'ready', installed: true,
        packVersion: rec.manifest.packVersion,
        filesDone: rec.manifest.assets.length,
        filesTotal: rec.manifest.assets.length,
        verified: canHash(), failed: [], error: null,
      })
    } else {
      // A pointer left behind by an evicted pack is a lie. Drop it so
      // the first-run prompt can offer the download again.
      if (readPointer()) clearPointer()
      registry.setPackState({
        phase: 'idle', installed: false,
        packVersion: rec.manifest?.packVersion || null,
        filesTotal: rec.manifest?.assets.length || 0,
        filesDone: rec.manifest ? (rec.manifest.assets.length - (rec.missing?.length || 0)) : 0,
        verified: canHash(),
      })
    }

    return rec
  })()
  return booted
}

// ── Fetching the manifest ─────────────────────────────────────
async function loadManifest({ preferCached = false } = {}) {
  // readManifest re-parses what IndexedDB gave back, so a cached
  // manifest has the same shape as a freshly fetched one.
  if (preferCached) {
    const cached = await readManifest().catch(() => null)
    if (cached) return cached
  }
  registry.setPackState({ phase: 'checking', error: null })
  try {
    return await fetchManifest(MANIFEST_URL)
  } catch (e) {
    const cached = await readManifest().catch(() => null)
    if (cached) return cached
    throw e
  }
}

// ── Install / update ──────────────────────────────────────────
/**
 * Downloads whatever the current manifest asks for that isn't already
 * stored. Safe to call twice — the second call joins the first.
 */
export async function installPack() {
  if (isRunning()) return { ok: false, reason: 'busy' }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    registry.setPackState({ phase: 'offline', error: 'offline' })
    return { ok: false, reason: 'offline' }
  }

  let manifest
  try {
    manifest = await loadManifest()
  } catch (e) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    registry.setPackState({
      phase: offline ? 'offline' : 'error',
      error: offline ? 'offline' : (e?.message || 'manifest-failed'),
    })
    return { ok: false, reason: e?.message || 'manifest-failed' }
  }

  registry.applyManifest(manifest)
  requestPersistence()   // iOS says no; asking costs nothing

  const result = await ensureDownload(manifest, {
    onDone: async (m) => {
      // Only record the manifest once every file it names is on disk,
      // so a half-finished pack never reads as installed.
      await writeManifest(serialisable(m))
      await collectGarbage(m)
      writePointer({ v: 1, packVersion: m.packVersion, installedAt: Date.now(), count: m.assets.length })
    },
  })

  return result
}

/** Same path as install — content-addressing makes an update just a smaller install. */
export const updatePack = installPack

/**
 * Quietly bring an installed pack up to the published version.
 *
 * initPack only reconciles against the manifest already in IndexedDB,
 * which is the right answer for "can I draw right now" and the wrong
 * one for "is there newer art". Without this, publishing new pieces
 * reached nobody who had already installed — the pack sat at whatever
 * version it was first downloaded at until someone happened to open
 * Settings and press the update button.
 *
 * Content addressing makes this cheap: only files whose hash is not
 * already stored are fetched, so a twelve-image addition to a sixty
 * image pack transfers twelve images.
 *
 * Deliberately silent. It runs behind a screen the user is already
 * looking at, so it must never take over the pack UI's phase or
 * report a failure — art that does not arrive falls back to what the
 * app drew before it existed, which is the same state as not having
 * run at all.
 */
export async function syncPack() {
  const state = registry.getPackState()
  // A device with no pack yet belongs to the first-run prompt, not here.
  if (!state.installed) return { ok: false, reason: 'not-installed' }
  if (isRunning()) return { ok: false, reason: 'busy' }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, reason: 'offline' }
  }

  let manifest
  try {
    manifest = await fetchManifest(MANIFEST_URL)
  } catch {
    return { ok: false, reason: 'manifest-failed' }
  }

  if (manifest.packVersion === state.packVersion) return { ok: true, reason: 'current' }

  // Only the id→remote-URL map changes here; the object URLs already
  // on screen are untouched, so nothing blanks while the diff lands.
  registry.applyManifest(manifest)

  return ensureDownload(manifest, {
    onDone: async (m) => {
      await writeManifest(serialisable(m))
      await collectGarbage(m)
      writePointer({ v: 1, packVersion: m.packVersion, installedAt: Date.now(), count: m.assets.length })
    },
  })
}

export function cancelInstall() { cancelDownload() }

export async function deletePack() {
  cancelDownload()
  registry.revokeAll()
  try { await wipe() } catch {}
  clearPointer()
  registry.applyManifest(null)
  registry.setPackState({
    phase: 'idle', installed: false, packVersion: null,
    filesDone: 0, filesTotal: 0, bytesDone: 0, bytesTotal: 0,
    failed: [], error: null,
  })
}

// Only the plain fields survive a structured clone usefully; the Maps
// are rebuilt by parseManifest on the way back in.
const serialisable = (m) => ({
  schemaVersion: m.schemaVersion,
  packVersion: m.packVersion,
  baseUrl: m.baseUrl,
  assets: m.assets.map(a => ({
    id: a.id, file: a.file, sha256: a.sha256, bytes: a.bytes,
  })),
})

export const __resetForTests = () => { booted = null }
