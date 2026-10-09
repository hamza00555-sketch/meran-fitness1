// ── What is on top right now ──────────────────────────────────
//
// The system layer has to know when something else owns the screen: a
// toast raised under the workout player or a sheet must wait instead of
// running its clock out unseen, and the changelog or the art offer must
// not open over a session restored at launch (the player is a cover in
// #root; a kit Sheet is portalled after it and would land on top).
//
// Two questions, both answered from the live DOM so they keep working
// whatever the rest of the app adds:
//   · hitsOwn(el)        — is `el` the topmost thing at its own centre?
//   · screenTaken()      — is a full-screen layer up (the session cover,
//                          the summary, onboarding, any modal dialog)?
// and one hook that re-asks whenever the DOM changes.

import { useLayoutEffect, useState } from 'react'

/** Full-screen layers that own the screen while they are mounted. */
export const COVER_SELECTOR = '.f-cover, [data-testid="session-cover"], .sum, .ob, [role="dialog"][aria-modal="true"]'

/** The topmost element at (x, y) that is not inside `skip`. */
export function topAt(x, y, skip) {
  if (typeof document === 'undefined') return null
  const vw = window.innerWidth, vh = window.innerHeight
  const px = Math.min(Math.max(x, 1), vw - 1)
  const py = Math.min(Math.max(y, 1), vh - 1)
  const list = document.elementsFromPoint ? document.elementsFromPoint(px, py) : [document.elementFromPoint(px, py)]
  for (const n of list) if (n && !(skip && skip.contains(n))) return n
  return null
}

/** True when `el` is what a finger at its centre would touch. */
export function hitsOwn(el, skip) {
  if (!el || !el.isConnected) return false
  const r = el.getBoundingClientRect()
  if (!(r.width > 0 && r.height > 0)) return false
  const top = topAt(r.left + r.width / 2, r.top + r.height / 2, skip)
  return !!top && el.contains(top)
}

/** Is a full-screen layer mounted (other than `except`)? */
export function screenTaken(except) {
  if (typeof document === 'undefined') return false
  for (const el of document.querySelectorAll(COVER_SELECTOR)) {
    if (except && (except === el || except.contains(el))) continue
    if (el.getClientRects().length) return true
  }
  return false
}

/**
 * Re-run `fn` (coalesced to one call per frame) whenever the page
 * changes in a way that can move a layer: nodes added or removed,
 * classes or inline styles changed, an animation or transition ended,
 * the viewport resized. `ignore` is an element (or a function returning
 * one) whose own changes do not count — the caller's node. Returns the function that stops watching.
 */
export function watchLayers(fn, { ignore = null } = {}) {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {}
  let raf = 0
  const kick = () => {
    if (raf) return
    raf = requestAnimationFrame(() => { raf = 0; fn() })
  }
  const outside = (n) => {
    const ig = typeof ignore === 'function' ? ignore() : ignore
    return !ig || !n || !ig.contains(n)
  }
  const mo = new MutationObserver((records) => {
    for (const r of records) if (outside(r.target)) { kick(); return }
  })
  mo.observe(document.body, {
    childList: true, subtree: true,
    attributes: true, attributeFilter: ['class', 'style', 'hidden', 'inert', 'open', 'aria-modal'],
  })
  const onAnim = (e) => { if (outside(e.target)) kick() }
  document.addEventListener('animationend', onAnim, true)
  document.addEventListener('transitionend', onAnim, true)
  window.addEventListener('resize', kick)
  return () => {
    mo.disconnect()
    cancelAnimationFrame(raf)
    document.removeEventListener('animationend', onAnim, true)
    document.removeEventListener('transitionend', onAnim, true)
    window.removeEventListener('resize', kick)
  }
}

/**
 * true once no full-screen layer is up, re-checked as the DOM changes.
 * Used to hold a sheet of record (What's New, the art offer) until the
 * lifter is not mid-session — then it opens, and stays open.
 */
export function useScreenClear(enabled = true) {
  // Unknown until the commit lands: a cover rendered in the same pass is
  // not in the DOM yet at render time, so start "not clear" and ask in a
  // layout effect, before anything is painted.
  const [clear, setClear] = useState(false)
  useLayoutEffect(() => {
    if (!enabled) return undefined
    const check = () => setClear(!screenTaken())
    check()
    return watchLayers(check)
  }, [enabled])
  return clear
}
