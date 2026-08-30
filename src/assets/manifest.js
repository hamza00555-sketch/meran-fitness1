// ── The pack manifest ─────────────────────────────────────────
// The file list, their hashes, and the slot id each file fills.
// It is data fetched at runtime, not code in the bundle, so new or
// re-drawn artwork ships by publishing a manifest rather than a new
// build of the app.

export const SUPPORTED_SCHEMA = 1

const isHex64 = (s) => typeof s === 'string' && /^[0-9a-f]{64}$/i.test(s)

/**
 * Validates a raw manifest and returns a normalised one, or throws.
 * A manifest from a newer schema is refused rather than half-read:
 * an old build guessing at new fields is worse than no pack at all.
 */
export function parseManifest(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('manifest-malformed')

  const schema = Number(raw.schemaVersion)
  if (!Number.isFinite(schema)) throw new Error('manifest-malformed')
  if (schema > SUPPORTED_SCHEMA) throw new Error('manifest-too-new')

  if (!Array.isArray(raw.assets) || !raw.assets.length) throw new Error('manifest-empty')
  if (typeof raw.baseUrl !== 'string' || !raw.baseUrl) throw new Error('manifest-no-base')

  const baseUrl = raw.baseUrl.endsWith('/') ? raw.baseUrl : raw.baseUrl + '/'
  const assets = []
  const byId = new Map()

  for (const a of raw.assets) {
    if (!a || typeof a.id !== 'string' || !a.id) continue
    if (typeof a.file !== 'string' || !a.file) continue
    if (!isHex64(a.sha256)) continue          // unverifiable — refuse it outright
    if (byId.has(a.id)) continue              // first definition of an id wins

    const asset = {
      id: a.id,
      file: a.file,
      sha256: a.sha256.toLowerCase(),
      bytes: Number(a.bytes) > 0 ? Number(a.bytes) : 0,
      url: baseUrl + a.file,
      // Optional media type (e.g. video/mp4). Same schema version:
      // clients that predate it never read the key, so it costs
      // nothing to carry and nothing to ignore.
      ...(typeof a.type === 'string' && a.type ? { type: a.type } : {}),
    }
    byId.set(a.id, asset)
    assets.push(asset)
  }

  if (!assets.length) throw new Error('manifest-empty')

  return {
    schemaVersion: schema,
    packVersion: String(raw.packVersion || '0'),
    baseUrl,
    assets,
    byId,
    totalBytes: assets.reduce((n, a) => n + a.bytes, 0),
  }
}

/** Fetches and validates the manifest. Cache-busted so a stale CDN copy can't pin an old pack. */
export async function fetchManifest(url, { signal } = {}) {
  const res = await fetch(url, { signal, cache: 'no-cache', credentials: 'omit', mode: 'cors' })
  if (!res.ok) {
    const err = new Error(`manifest-http-${res.status}`)
    err.status = res.status
    throw err
  }
  return parseManifest(await res.json())
}
