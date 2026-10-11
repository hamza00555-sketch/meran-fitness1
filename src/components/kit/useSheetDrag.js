import { useEffect, useRef } from 'react'
import { animate, reducedMotion } from '../../motion.js'
import { DRAG_SLOP, rubberBand, releaseVelocity, shouldDismiss, exitDuration } from '../../sheetDrag.js'

// ── A sheet you can pull down to close ────────────────────────
//
// Phase 5. The sheet follows the finger; the scrim lightens with it. Let
// go and src/sheetDrag.js decides: it leaves from where it is at the
// finger's speed and then asks to close (`onDismiss`), or springs back on
// the sheet spring. Pulled up, it gives like rubber (the sheet's ::after
// keeps its foot on the floor meanwhile).
//
// Where a drag may start: the grabber and the title row always; anywhere
// else on a touch screen only moving down with the content scrolled to
// its top — so scrolling a long list, typing, and sideways rows inside a
// sheet are untouched. A mouse drags from the grabber and title only.
// Touch uses touch events (a non-passive touchmove is the only way to
// take a gesture the browser would otherwise scroll); mouse and pen use
// pointer events.
//
// Returns a ref that reads true once the sheet has left under the finger,
// so the Sheet can skip its own exit animation (and unmount at once,
// which releases its scroll lock at once — scrollLock.js counts, so
// sheets that overlap still leave the page free). If nobody closes it,
// it comes back.

const NO_DRAG = 'input, textarea, select, [contenteditable="true"], [data-no-drag]'
const HANDLE = '.k-sheet-grab, .k-sheet-h'

function scrollerIn(sheet, target) {
  for (let el = target; el && el !== sheet; el = el.parentElement) {
    if (el.scrollHeight > el.clientHeight + 1) {
      const oy = getComputedStyle(el).overflowY
      if (oy === 'auto' || oy === 'scroll') return el
    }
  }
  return null
}

export function useSheetDrag({ sheetRef, scrimRef, onDismiss, enabled = true }) {
  const left = useRef(false)
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss

  useEffect(() => {
    const sheet = sheetRef.current
    if (!enabled || !sheet) return
    left.current = false
    const scrim = scrimRef?.current || null
    // The dimming is the scrim's own layer (.k-scrim-bg), not the scrim:
    // the sheet sits inside the scrim, and fading that would fade it too.
    const shade = scrim?.querySelector(':scope > .k-scrim-bg') || null
    let g = null                // the gesture under way
    let quietUntil = 0          // swallow the click a drag ends with
    let back = null             // the timer that brings back a sheet nobody closed

    const start = (x, y, target, kind) => {
      if (left.current || !target || target.closest?.(NO_DRAG)) { g = null; return }
      const t = performance.now()
      g = {
        kind, x0: x, y0: y, mode: 'pending', dy: 0,
        handle: !!target.closest?.(HANDLE), scroller: scrollerIn(sheet, target),
        height: sheet.getBoundingClientRect().height || 1, samples: [{ t, y }],
      }
    }

    // true: the move is the sheet's (the caller cancels the browser's own).
    const move = (x, y) => {
      if (!g || g.mode === 'off') return false
      const dx = x - g.x0, dy = y - g.y0
      if (g.mode === 'pending') {
        const down = dy > 0 && Math.abs(dy) >= Math.abs(dx)
        const atTop = !g.scroller || g.scroller.scrollTop <= 0
        const ours = g.handle ? Math.abs(dy) >= Math.abs(dx) : (g.kind === 'touch' && down && atTop)
        if (!ours) {
          if (Math.hypot(dx, dy) >= DRAG_SLOP) g.mode = 'off'
          return false
        }
        if (Math.hypot(dx, dy) < DRAG_SLOP) return true    // claimed, not moving yet
        g.mode = 'drag'
        g.y0 = y                                             // no jump by the slop
        // The finger takes over at once: an entrance (or a spring back)
        // still running would hold the sheet where it is.
        try { sheet.getAnimations().forEach(a => a.cancel()) } catch {}
        try { shade?.getAnimations().forEach(a => a.cancel()) } catch {}
        sheet.setAttribute('data-dragging', '1')
      }
      const d = y - g.y0
      g.dy = d
      g.samples.push({ t: performance.now(), y })
      if (g.samples.length > 12) g.samples.shift()
      const shown = rubberBand(d)
      sheet.style.transform = `translateY(${shown}px)`
      if (shade) shade.style.opacity = String(Math.max(0, 1 - Math.max(0, shown) / g.height))
      return true
    }

    const end = () => {
      const gg = g
      g = null
      if (!gg || gg.mode !== 'drag') return
      quietUntil = performance.now() + 350
      sheet.removeAttribute('data-dragging')
      const vy = releaseVelocity(gg.samples)
      const shown = rubberBand(gg.dy)
      const opacity = shade ? parseFloat(shade.style.opacity || '1') : 1
      const reduce = reducedMotion()
      if (shouldDismiss({ dy: gg.dy, vy, height: gg.height })) {
        left.current = true
        const ms = exitDuration({ dy: gg.dy, height: gg.height, vy })
        const out = reduce
          ? animate(sheet, [{ opacity: 1 }, { opacity: 0 }], { d: 160, e: 'linear', fill: 'forwards' })
          : animate(sheet, [{ transform: `translateY(${shown}px)` }, { transform: `translateY(${gg.height + 48}px)` }],
            { d: ms, e: 'cubic-bezier(0.25, 0.6, 0.4, 1)', fill: 'forwards' })
        animate(shade, [{ opacity }, { opacity: 0 }], { d: reduce ? 160 : ms, e: 'linear', fill: 'forwards' })
        const done = () => {
          dismiss.current?.()
          // Still here a moment later: whoever owns it kept it open.
          back = setTimeout(() => {
            if (!sheet.isConnected) return
            left.current = false
            try { sheet.getAnimations().forEach(a => a.cancel()) } catch {}
            try { shade?.getAnimations().forEach(a => a.cancel()) } catch {}
            sheet.style.transform = ''
            if (shade) shade.style.opacity = ''
          }, 160)
        }
        if (out?.finished) out.finished.then(done, done)
        else done()
        return
      }
      // Back into place, on the sheet spring (a plain ease under reduced motion).
      sheet.style.transform = ''
      if (shade) shade.style.opacity = ''
      if (shown !== 0) {
        animate(sheet, [{ transform: `translateY(${shown}px)` }, { transform: 'none' }],
          reduce ? { d: 160, fill: 'none' } : { spring: 'sheet', fill: 'none' })
      }
      if (opacity < 1) animate(shade, [{ opacity }, { opacity: 1 }], { d: 200, fill: 'none' })
    }

    // ── Touch ──
    const onTouchStart = (e) => {
      if (e.touches.length !== 1) { g = null; return }
      const p = e.touches[0]
      start(p.clientX, p.clientY, e.target, 'touch')
    }
    const onTouchMove = (e) => {
      if (!g) return
      if (e.touches.length !== 1) { end(); return }
      const p = e.touches[0]
      if (move(p.clientX, p.clientY) && e.cancelable) e.preventDefault()
    }
    const onTouchEnd = () => end()

    // ── Mouse and pen ──
    const onPointerDown = (e) => {
      if (e.pointerType === 'touch' || (e.pointerType === 'mouse' && e.button !== 0)) return
      start(e.clientX, e.clientY, e.target, 'mouse')
      if (!g) return
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerUp)
    }
    const onPointerMove = (e) => { if (move(e.clientX, e.clientY)) e.preventDefault() }
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      end()
    }

    // The click a drag ends with is not a tap on what it ended over.
    const onClick = (e) => {
      if (performance.now() < quietUntil) { e.stopPropagation(); e.preventDefault() }
    }

    sheet.addEventListener('touchstart', onTouchStart, { passive: true })
    sheet.addEventListener('touchmove', onTouchMove, { passive: false })
    sheet.addEventListener('touchend', onTouchEnd)
    sheet.addEventListener('touchcancel', onTouchEnd)
    sheet.addEventListener('pointerdown', onPointerDown)
    sheet.addEventListener('click', onClick, true)
    scrim?.addEventListener('click', onClick, true)
    return () => {
      clearTimeout(back)
      sheet.removeEventListener('touchstart', onTouchStart)
      sheet.removeEventListener('touchmove', onTouchMove)
      sheet.removeEventListener('touchend', onTouchEnd)
      sheet.removeEventListener('touchcancel', onTouchEnd)
      sheet.removeEventListener('pointerdown', onPointerDown)
      sheet.removeEventListener('click', onClick, true)
      scrim?.removeEventListener('click', onClick, true)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  return left
}
