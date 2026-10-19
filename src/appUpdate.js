// ── A new version, put in when nothing is in the way ──────────
//
// حمزة: «احيانا لما ادخل خطتي البرنامج يعلق على شاشة سودا وماعاد يفتح».
//
// Why it happened. «خطتي» and the plan builder are chunks of their own,
// fetched the first time they open. The service worker used to take over
// the moment a new version finished downloading (skipWaiting) — under a
// page still running the old one — and its first act is to delete the
// old version's files from its cache. The old page then asked for its
// «خطتي» chunk, which the new deploy no longer has: the server answers
// every unknown path with index.html, the import failed, and with nothing
// to catch it React took the whole app down. A black screen, and on an
// iPhone home-screen app, which resumes the same page, it stayed black.
//
// Now a new version waits (no skipWaiting: vite.config.js) while this
// page runs, the old files stay in the cache for it, and it is put in at
// a moment nobody is using the app:
//   · the app goes to the background (hidden) with nothing open — no
//     session, no sheet, no page over the tabs — or
//   · the app has only just opened, nothing is on screen yet, and the
//     version was already waiting from an earlier visit (one that finishes
//     downloading while he looks at the app always waits for the first).
// Then the waiting worker is told to take over (SKIP_WAITING, which the
// generated sw.js listens for) and the page reloads into the new version.
//
// The browser only looks for a new version on a navigation, and a
// home-screen app coming back from the background is not one, so this
// also asks (reg.update()) when the app comes back to the front.
//
// A file of the running version found missing all the same (a page with
// no service worker, a chunk the cache never had: 'vite:preloadError',
// or a page that failed to load — src/lazyPage.js) marks the version
// stale, and the same quiet moment reloads it.

import { screenTaken } from './components/system/layers.js'

const CHECK_EVERY = 15 * 60 * 1000   // ask the server at most this often
const BOOT_WINDOW = 6000             // "only just opened"

let reg = null
let busy = true                       // until App says what is on screen
let stale = false
let applying = false
let lastCheck = 0
let waitingAtBoot = false
const bootAt = Date.now()

const swOk = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator

/** App: true while anything is open that a reload would throw away. */
export function setUpdateBusy(value) {
  busy = !!value
  maybeApply()
}

/** The running version is missing files on the server: reload at the next quiet moment. */
export function markStale() {
  stale = true
  maybeApply()
}

/**
 * Would a reload bring the app back? Not offline with no worker to answer
 * it: an iPhone shows its own error page in place of the app.
 */
export function reloadPossible() {
  if (typeof navigator === 'undefined') return false
  return navigator.onLine !== false || !!navigator.serviceWorker?.controller
}

/** A new version has downloaded and is waiting for this page to let it in. */
export const updateWaiting = () => !!(reg?.waiting && swOk() && navigator.serviceWorker.controller)

/** Register the worker and start watching for new versions. Once, at boot. */
export function startUpdates() {
  if (typeof window === 'undefined') return
  window.addEventListener('vite:preloadError', () => markStale())
  if (!swOk() || import.meta.env?.DEV) return
  const register = () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((r) => {
      reg = r
      lastCheck = Date.now()
      // Downloaded in an earlier visit and still waiting: the app has only
      // just opened, so it may go in now, before he starts on anything.
      if (r.waiting) { waitingAtBoot = true; maybeApply() }
      r.addEventListener('updatefound', () => {
        const w = r.installing
        w?.addEventListener('statechange', () => { if (w.state === 'installed') maybeApply() })
      })
    }).catch(() => { /* no worker: the app still runs, just not offline */ })
  }
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
  // Ours only: the first install also changes the controller (clientsClaim).
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (applying) location.reload() })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { maybeApply(); return }
    if (reg && Date.now() - lastCheck > CHECK_EVERY) {
      lastCheck = Date.now()
      reg.update().catch(() => {})
    }
  })
}

function quietMoment() {
  if (busy) return false
  // Whatever App did not tell us about: a sheet, a cover, a dialog.
  try { if (screenTaken()) return false } catch { /* no DOM: not quiet */ return false }
  if (document.visibilityState === 'hidden') return true
  // In front of him only in the first seconds after a launch, and only for
  // a version that was already waiting then — never one that finishes
  // downloading while he is looking at the app.
  return waitingAtBoot && Date.now() - bootAt < BOOT_WINDOW
}

function maybeApply() {
  if (applying || (!stale && !updateWaiting())) return
  if (!quietMoment() || !reloadPossible()) return
  reloadIntoUpdate()
}

/**
 * Reload into the newest version now: a waiting worker is let in first
 * (the reload follows its controllerchange), else a plain reload.
 */
export function reloadIntoUpdate() {
  if (applying) return
  applying = true
  const w = reg?.waiting
  if (w && navigator.serviceWorker.controller) {
    w.postMessage({ type: 'SKIP_WAITING' })
    // If the switch never comes (a worker that will not activate), reload anyway.
    setTimeout(() => location.reload(), 2500)
  } else {
    location.reload()
  }
}
