// ── Pages that load the first time they open ──────────────────
//
// «خطتي» and the plan builder are chunks of their own (App.jsx). A chunk
// can fail to arrive: the server deployed a new version and no longer has
// this one's file (see src/appUpdate.js for how that used to happen under
// a running page), or the network dropped. Before, the import's failure
// went straight to React with nothing to catch it, and the whole app went
// black. Now:
//
//   · Once loaded, the module is kept and rendered directly, so a page
//     prefetched at idle (Page.preload, App does it after Home) opens at
//     once and never needs the network again in this page's life.
//   · A failed load reloads the page once, automatically, into whatever
//     the server and the service worker have now — and opens the same
//     page again after the reload (REOPEN_KEY), so it looks like a slow
//     open, not a reset. A flag in sessionStorage (RELOAD_KEY) allows one
//     such reload per five minutes — whatever loads fine in between — and
//     none at all if the flag can't be written: it can never loop.
//   · Otherwise the failure is thrown as a ChunkError for the page's error
//     boundary (components/system/PageGuard.jsx), which offers
//     «جرّب مرة ثانية».

import { createElement, lazy, useState } from 'react'
import { reloadIntoUpdate, reloadPossible, markStale } from './appUpdate.js'

export const RELOAD_KEY = 'meran_chunk_reload'
export const REOPEN_KEY = 'meran_reopen'
const RELOAD_GAP = 5 * 60 * 1000
const REOPEN_FOR = 60 * 1000

const session = {
  get(k) { try { return sessionStorage.getItem(k) } catch { return null } },
  set(k, v) { try { sessionStorage.setItem(k, v); return sessionStorage.getItem(k) === v } catch { return false } },
  remove(k) { try { sessionStorage.removeItem(k) } catch { /* nothing to remove */ } },
}

/** A page's code could not be loaded (not a bug inside the page). */
export class ChunkError extends Error {
  constructor(page, cause) {
    super(`meran: «${page}» did not load`)
    this.name = 'ChunkError'
    this.chunk = true
    this.cause = cause
  }
}

const CHUNK_WORDS = /dynamically imported module|importing a module script failed|error loading dynamically imported|unable to preload css|failed to load module script|module script|chunk/i
/** Is this the failure of a chunk to arrive (as opposed to a bug in the page)? */
export const isChunkError = (e) => !!e && (e.chunk === true || e.name === 'ChunkLoadError' || CHUNK_WORDS.test(String(e?.message ?? e)))

/** One automatic reload per five minutes, and only when the flag sticks. */
export function claimReload(now = Date.now()) {
  const last = Number(session.get(RELOAD_KEY)) || 0
  if (now - last < RELOAD_GAP) return false
  return session.set(RELOAD_KEY, String(now))
}

/**
 * Reload into the newest version, then open `intent` again
 * ({ page, …what it opened with }). Not when offline with no service
 * worker to answer: the reload itself would fail, and an iPhone shows its
 * own error page in place of the app.
 */
export function reloadInto(intent) {
  if (!reloadPossible()) return false
  if (intent) session.set(REOPEN_KEY, JSON.stringify({ ...intent, at: Date.now() }))
  reloadIntoUpdate()
  return true
}

/** What to open again after a reload for a missing chunk, once (null if none, or too old). */
export function takeReopen(now = Date.now()) {
  const raw = session.get(REOPEN_KEY)
  if (!raw) return null
  session.remove(REOPEN_KEY)
  try {
    const v = JSON.parse(raw)
    return v && typeof v.page === 'string' && now - (Number(v.at) || 0) < REOPEN_FOR ? v : null
  } catch { return null }
}

/**
 * lazy() for a page App opens over the app. `name` is the page's key in
 * REOPEN_KEY ('planview', 'planner'); `intent(props)` says what to open
 * again after a reload. Returns a component with preload().
 */
export function lazyPage(load, { name, intent } = {}) {
  let mod = null
  let pending = null
  let Lazy = null
  let lastIntent = null

  // (A success never clears RELOAD_KEY: another page loading fine after
  // the reload must not buy this one a second automatic reload.)
  const fetchModule = () => pending || (pending = load().then(
    (m) => { mod = m; return m },
    (e) => { pending = null; throw e },
  ))

  const opened = () => fetchModule().catch((err) => {
    // He is waiting on this page: reload once into a version that has it.
    if (reloadPossible() && claimReload()) {
      reloadInto({ page: name, ...lastIntent })
      return new Promise(() => {})   // the reload is coming; keep the loading state up
    }
    markStale()
    throw new ChunkError(name, err)
  })

  function Page(props) {
    lastIntent = intent ? intent(props) : null
    // Decided once per mount: switching from the lazy wrapper to the module
    // itself mid-life would remount the page and lose what it holds.
    const [direct] = useState(() => !!mod)
    if (direct) return createElement(mod.default, props)
    if (!Lazy) Lazy = lazy(opened)
    return createElement(Lazy, props)
  }
  Page.displayName = `Page(${name})`
  /** Fetch it now, quietly (idle prefetch). A failure here costs nothing: opening it tries again. */
  Page.preload = () => fetchModule().then(() => true, () => { markStale(); return false })
  /** After a failure: the next render starts a fresh load. */
  Page.reset = () => { Lazy = null; pending = null }
  Page.loaded = () => !!mod
  return Page
}
