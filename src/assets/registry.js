// ── The live icon registry ────────────────────────────────────
// A module-level store with a subscribe/notify pair, read through
// useSyncExternalStore. This is what makes the swap happen without
// a restart: the instant a blob is verified and its URL is minted,
// every <Ico> on screen re-renders with the image.
//
// It is deliberately not a React context. Pages import constants.js
// directly rather than receiving art through props, so a context
// would mean threading a provider through the whole tree for data
// that is genuinely global and genuinely mutable outside React.

let version = 0
const listeners = new Set()

const urls   = new Map()   // asset id  -> object URL
const idBy   = new Map()   // emoji     -> asset id
const remote = new Map()   // asset id  -> absolute https URL (for OS notifications)
const broken = new Set()   // asset ids whose <img> failed to decode

let packState = {
  phase: 'unknown',   // unknown|idle|checking|downloading|verifying|ready|error|offline|nospace|unsupported
  installed: false,
  packVersion: null,
  filesDone: 0,
  filesTotal: 0,
  bytesDone: 0,
  bytesTotal: 0,
  verified: true,     // false when running without crypto.subtle
  failed: [],         // [{ id, reason }]
  error: null,
}

export const subscribe = (cb) => { listeners.add(cb); return () => { listeners.delete(cb) } }
export const getVersion = () => version

// getSnapshot has to be Object.is-stable between renders or React 18
// throws "getSnapshot should be cached". An integer counter is the
// one shape that cannot get this wrong.
export function bump() {
  version++
  for (const cb of listeners) cb()
}

export const getPackState = () => packState
export function setPackState(patch) {
  packState = { ...packState, ...patch }
  bump()
}

// ── Lookups (called during render — keep them cheap) ──────────
export const urlFor      = (id) => (id && !broken.has(id) ? urls.get(id) : undefined)
export const remoteUrlFor = (id) => (id ? remote.get(id) : undefined)
export const idForEmoji  = (emoji) => (emoji ? idBy.get(emoji) : undefined)
export const isInstalled = () => packState.installed

/** An <img> that failed to decode must not be retried every render. */
export function markBroken(id) {
  if (!id || broken.has(id)) return
  broken.add(id)
  bump()
}

/** Teaches the registry the emoji→id and id→remote-URL maps from a manifest. */
export function applyManifest(manifest) {
  idBy.clear()
  remote.clear()
  if (!manifest) { bump(); return }
  const pairs = manifest.emojiToId
    || (manifest.assets || []).flatMap(a => (a.emoji || []).map(e => [e, a.id]))
  for (const [emoji, id] of pairs) if (!idBy.has(emoji)) idBy.set(emoji, id)
  for (const a of manifest.assets || []) remote.set(a.id, a.pngUrl || a.url)
  bump()
}

/**
 * Mints every object URL in one pass.
 *
 * Creating them per component — in a body, a useMemo, or a per-icon
 * effect — leaks one URL per render for the life of the document.
 * Created here they are bounded by the pack size and revoked only
 * when the pack is replaced or deleted.
 */
export function hydrate(manifest, blobsBySha) {
  revokeAll()
  if (!manifest) { bump(); return 0 }
  let n = 0
  for (const a of manifest.assets) {
    const blob = blobsBySha.get(a.sha256)
    if (!blob) continue
    urls.set(a.id, URL.createObjectURL(blob))
    n++
  }
  broken.clear()
  bump()
  return n
}

/** Publishes a single asset the moment it lands, mid-download. */
export function put(id, blob) {
  if (!id || !blob) return
  const prev = urls.get(id)
  urls.set(id, URL.createObjectURL(blob))
  broken.delete(id)
  if (prev) URL.revokeObjectURL(prev)
  bump()
}

export function revokeAll() {
  for (const u of urls.values()) { try { URL.revokeObjectURL(u) } catch {} }
  urls.clear()
  broken.clear()
}

export const count = () => urls.size

// Object URLs die with the document anyway, but releasing them on
// pagehide keeps memory honest when iOS freezes a backgrounded PWA.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => revokeAll())
}

export const __resetForTests = () => {
  revokeAll(); idBy.clear(); remote.clear(); listeners.clear()
  version = 0
  packState = { phase: 'unknown', installed: false, packVersion: null, filesDone: 0,
    filesTotal: 0, bytesDone: 0, bytesTotal: 0, verified: true, failed: [], error: null }
}
