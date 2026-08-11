// ── The pack manifest ─────────────────────────────────────────
// Everything that makes the pack extensible lives here: the file
// list, their hashes, and — crucially — which emoji each asset
// stands in for. That mapping is data fetched at runtime, not code
// in the bundle, so adding an icon later means publishing a new
// manifest, not shipping a new build.

export const SUPPORTED_SCHEMA = 1

// U+FE0F / U+FE0E only say "draw this as a picture" or "as text".
// The same glyph with and without the selector must resolve to one
// id, or half the call sites silently miss.
export const normalizeEmoji = (s) =>
  typeof s === 'string' ? s.replace(/[\uFE0E\uFE0F]/g, '') : ''

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
  const emojiToId = new Map()
  const claimed = new Map() // emoji -> first id that claimed it

  for (const a of raw.assets) {
    if (!a || typeof a.id !== 'string' || !a.id) continue
    if (typeof a.file !== 'string' || !a.file) continue
    if (!isHex64(a.sha256)) continue          // unverifiable — refuse it outright
    if (byId.has(a.id)) continue              // first definition of an id wins

    const asset = {
      id: a.id,
      file: a.file,
      png: typeof a.png === 'string' ? a.png : null,
      sha256: a.sha256.toLowerCase(),
      bytes: Number(a.bytes) > 0 ? Number(a.bytes) : 0,
      emoji: [],
      url: baseUrl + a.file,
      pngUrl: typeof a.png === 'string' ? baseUrl + a.png : null,
    }

    for (const e of Array.isArray(a.emoji) ? a.emoji : []) {
      const key = normalizeEmoji(e)
      if (!key) continue
      asset.emoji.push(key)
      // Two assets claiming the same emoji is a publishing mistake.
      // Resolve it the same way every time so the UI can't flicker
      // between builds, and say so loudly enough to get it fixed.
      if (claimed.has(key)) {
        console.warn(`meran/assets: emoji ${key} claimed by both "${claimed.get(key)}" and "${a.id}" — keeping the first`)
        continue
      }
      claimed.set(key, a.id)
      emojiToId.set(key, a.id)
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
    emojiToId,
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
