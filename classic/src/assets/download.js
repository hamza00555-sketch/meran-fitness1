// ── The downloader ────────────────────────────────────────────
// Bounded concurrency, per-file retry with exponential backoff and
// jitter, cancellable, and resumable.
//
// Resume falls out of content-addressing for free: "do I already
// have a verified blob under this hash?" is the whole predicate. A
// download killed at file 20 of 120 restarts having to fetch 100,
// with no bookkeeping to get out of sync.

import { verifyAndStore, storedShas, hasRoomFor, canHash, IntegrityError } from './store.js'
import { getBlobRec } from './idb.js'
import * as registry from './registry.js'

export const CONCURRENCY = 4
export const MAX_ATTEMPTS = 4
// Consecutive network failures that mean "the connection is gone",
// not "these files are unlucky".
export const NETWORK_GIVE_UP = 5
const BASE_DELAY = 600

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms)
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('aborted', 'AbortError')) }, { once: true })
})

const backoff = (attempt) => {
  const flat = BASE_DELAY * Math.pow(2, attempt - 1)
  return flat + Math.random() * flat * 0.4   // jitter, so retries don't march in lockstep
}

// A 404 means the manifest points at a file that is not there. No
// amount of waiting fixes that, and retrying it four times just
// makes a broken publish slower to diagnose.
const isPermanent = (status) => status >= 400 && status < 500 && status !== 408 && status !== 429

class HttpError extends Error {
  constructor(status) { super(`http-${status}`); this.name = 'HttpError'; this.status = status }
}

async function fetchOne(asset, signal) {
  const res = await fetch(asset.url, { signal, cache: 'no-store', credentials: 'omit', mode: 'cors' })
  if (!res.ok) throw new HttpError(res.status)
  // The manifest's declared type outranks the wire: a bucket that says
  // application/octet-stream would otherwise bake the wrong MIME into
  // the stored blob, and Safari refuses to play a video blob it cannot
  // type. The wire is only the fallback for legacy assets that never
  // declared one.
  const type = asset.type || res.headers.get('content-type') || 'image/webp'
  return { buf: await res.arrayBuffer(), type }
}

/** One asset, all its retries. Resolves to a reason string on failure rather than throwing. */
async function acquire(asset, signal, onBytes) {
  let lastReason = 'network'
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
    try {
      const { buf, type } = await fetchOne(asset, signal)
      await verifyAndStore(asset, buf, type)
      onBytes?.(buf.byteLength)
      return { ok: true }
    } catch (e) {
      if (e?.name === 'AbortError') throw e
      if (e instanceof IntegrityError) {
        lastReason = 'hash'
        // Worth one more try — a truncated response hashes wrong too.
      } else if (e instanceof HttpError) {
        lastReason = 'http'
        if (isPermanent(e.status)) return { ok: false, reason: 'http', status: e.status }
      } else {
        lastReason = 'network'
      }
      if (attempt < MAX_ATTEMPTS) {
        try { await sleep(backoff(attempt), signal) }
        catch { throw new DOMException('aborted', 'AbortError') }
      }
    }
  }
  return { ok: false, reason: lastReason }
}

// StrictMode runs effects twice and the Settings button can be
// double-tapped. A module-level promise — not a ref, which is
// per-component — makes a second call join the run in progress.
let inflight = null
let controller = null

export const isRunning = () => !!inflight

export function cancel() {
  try { controller?.abort() } catch {}
}

/**
 * Downloads everything in the manifest that isn't already stored.
 * Publishes each asset to the registry as it verifies, so icons
 * appear on screen during the download rather than after it.
 */
export function ensureDownload(manifest, opts) {
  if (inflight) return inflight
  controller = new AbortController()
  inflight = run(manifest, controller.signal, opts).finally(() => { inflight = null; controller = null })
  return inflight
}

async function run(manifest, signal, { onDone } = {}) {
  const have = await storedShas()

  // Two slots can legitimately share one picture, and content-addressing
  // means they share one hash. Fetch each distinct hash once and publish
  // the result to every slot that uses it.
  const wanted = new Map()   // sha -> { asset, ids: [] }
  for (const a of manifest.assets) {
    if (have.has(a.sha256)) continue
    const entry = wanted.get(a.sha256)
    if (entry) entry.ids.push(a.id)
    else wanted.set(a.sha256, { asset: a, ids: [a.id] })
  }
  const todo = [...wanted.values()]

  const bytesTotal = todo.reduce((n, t) => n + (t.asset.bytes || 0), 0)

  if (!todo.length) {
    registry.setPackState({ phase: 'ready', installed: true, packVersion: manifest.packVersion,
      filesDone: manifest.assets.length, filesTotal: manifest.assets.length,
      bytesDone: 0, bytesTotal: 0, failed: [], error: null })
    await onDone?.(manifest)
    return { ok: true, failed: [] }
  }

  if (!(await hasRoomFor(bytesTotal))) {
    registry.setPackState({ phase: 'nospace', error: 'nospace', bytesTotal })
    return { ok: false, failed: [], reason: 'nospace' }
  }

  // Progress is counted in slots, which is what the person sees, even
  // though the transfers are counted in distinct files.
  const slotsPending = todo.reduce((n, t) => n + t.ids.length, 0)
  let filesDone = manifest.assets.length - slotsPending
  let bytesDone = 0
  const failed = []

  registry.setPackState({
    phase: 'downloading', packVersion: manifest.packVersion,
    filesDone, filesTotal: manifest.assets.length,
    bytesDone: 0, bytesTotal, failed: [], error: null,
    verified: canHash(),
  })

  // When the network goes away mid-download, every remaining file
  // would otherwise burn its full retry ladder before anyone is told.
  // A run of consecutive network failures means the connection is
  // gone, not that these particular files are unlucky: stop, report,
  // and let the user retry — resume makes that cheap.
  let consecutiveNetFails = 0
  let gaveUp = false

  let cursor = 0
  const worker = async () => {
    for (;;) {
      if (signal.aborted || gaveUp) return
      const i = cursor++
      if (i >= todo.length) return
      const { asset, ids } = todo[i]

      const result = await acquire(asset, signal, (n) => {
        // bytesDone only ever moves forward: progress that jumps
        // backwards on a retry reads as a bug to the person watching.
        bytesDone += n
      })

      if (result.ok) {
        consecutiveNetFails = 0
        filesDone += ids.length
        const rec = await getBlobRec(asset.sha256).catch(() => null)
        if (rec?.blob) for (const id of ids) registry.put(id, rec.blob)
      } else {
        for (const id of ids) failed.push({ id, reason: result.reason })
        if (result.reason === 'network') {
          if (++consecutiveNetFails >= NETWORK_GIVE_UP) gaveUp = true
        } else {
          consecutiveNetFails = 0
        }
      }
      registry.setPackState({ filesDone, bytesDone, failed: [...failed] })
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker))
  } catch (e) {
    if (e?.name === 'AbortError') {
      registry.setPackState({ phase: 'idle' })
      return { ok: false, failed, reason: 'aborted' }
    }
    throw e
  }

  if (signal.aborted) {
    registry.setPackState({ phase: 'idle' })
    return { ok: false, failed, reason: 'aborted' }
  }

  const complete = failed.length === 0
  if (complete) await onDone?.(manifest)

  // A connection that dropped is a different message from files that
  // are genuinely broken, and only one of the two is worth retrying
  // straight away.
  const lostNetwork = gaveUp || (typeof navigator !== 'undefined' && navigator.onLine === false)

  registry.setPackState({
    phase: complete ? 'ready' : lostNetwork ? 'offline' : 'error',
    installed: complete,
    filesDone, bytesDone,
    failed: [...failed],
    error: complete ? null : lostNetwork ? 'offline' : 'partial',
  })

  return { ok: complete, failed, reason: complete ? null : lostNetwork ? 'offline' : 'partial' }
}

export const __resetForTests = () => { inflight = null; controller = null }
