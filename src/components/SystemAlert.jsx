// ── The toast ─────────────────────────────────────────────────
//
// One design for every notice the app raises with pushAlert(icon, msg).
// It used to drop from the top of the screen over the header and the
// greeting; now it docks at the bottom, above the tab bar (or above the
// live bar when a session is minimised), where it covers nothing you
// were reading (critique F33).
//
//   · surface-2, its edge and top light, radius 16, 15px text
//   · a Phosphor icon in place of the emoji it was handed; the colour
//     comes from the role (rest blue for tickets, accent for done…)
//   · auto-dismiss after 3.2s, with a thin line draining from the start
//     edge; holding it pauses, tap or swipe sends it away
//   · it is only on the clock while it can be seen. Raised under the
//     workout player, the summary or a sheet, it waits — no timer, no
//     drain — and shows once that layer is gone; covered mid-way, it
//     waits again and comes back with a full clock. A warning (danger)
//     does not wait: it rises above every cover and docks above the
//     cover's own bottom controls ([data-toast-avoid]), because
//     «التخزين ممتلئ — الجلسة ما انحفظت» cannot wait for the end of a set.
//   · the queue API is unchanged: `alerts` is the queue, the head is
//     shown, `onRemove()` drops the head; a merged repeat (same icon)
//     bumps the timer and shows ×N.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Warning } from '@phosphor-icons/react'
import { Num } from './kit/index.jsx'
import { resolveGlyph, Glyph, isolateRuns } from './system/glyphs.jsx'
import { hitsOwn, watchLayers } from './system/layers.js'
import '../styles/screens/system.css'

const DURATION = 3200 // ms on screen
const EXIT     = 170  // ms for the way out
const GAP      = 12   // px above whatever is docked at the bottom
// Nothing visible to sit above (a cover with no marked controls): just
// clear the home indicator.
const FLOOR    = 'calc(var(--safe-bottom) + 12px)'

const cx = (...a) => a.filter(Boolean).join(' ')

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Where the toast sits: just above the highest bar docked at the bottom
 *  that is actually on top right now (the tab bar, the live bar, or
 *  anything marked data-toast-avoid — a bar under a cover does not
 *  count). FLOOR when there is none. */
function dockOffset(dock) {
  const vh = window.innerHeight
  let top = Infinity
  document.querySelectorAll('.f-tabs, .f-livebar, [data-toast-avoid]').forEach(el => {
    if (dock.contains(el)) return
    const r = el.getBoundingClientRect()
    if (!(r.height > 0 && r.top > vh * 0.5 && r.top < vh)) return
    if (!hitsOwn(el, dock)) return
    top = Math.min(top, r.top)
  })
  return Number.isFinite(top) ? `${Math.round(vh - top + GAP)}px` : FLOOR
}

export default function SystemAlert({ alerts: queue, onRemove }) {
  const current = queue[0]

  const [shown, setShown]     = useState(false)     // on screen and on the clock
  const [leaving, setLeaving] = useState(false)
  const [exitDir, setExitDir] = useState(null)      // 'left' | 'right' | null
  const [drag, setDrag]       = useState(null)      // { dx, dy } while a finger is on it
  const [held, setHeld]       = useState(false)
  const [run, setRun]         = useState(0)         // restarts the drain

  const dockRef   = useRef(null)
  const cardRef   = useRef(null)
  const timerRef  = useRef(null)
  const exitRef   = useRef(null)
  const startRef  = useRef(null)
  const removeRef = useRef(onRemove)
  removeRef.current = onRemove
  // Mirrors of state for the observers, which live outside React's render.
  const live = useRef({ shown: false, leaving: false, held: false, id: null })

  const glyph = current ? resolveGlyph(current.icon) : null
  let tone = glyph?.tone || 'neutral'
  // A warning about the streak is the streak's to colour.
  if (glyph?.Icon === Warning && /ستريك/.test(String(current?.msg || ''))) tone = 'streak'
  const urgent = tone === 'danger'

  const dismiss = useCallback((dir = null) => {
    clearTimeout(timerRef.current)
    clearTimeout(exitRef.current)
    live.current.leaving = true
    setExitDir(dir)
    setLeaving(true)
    exitRef.current = setTimeout(() => removeRef.current?.(), reducedMotion() ? 0 : EXIT)
  }, [])

  const arm = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => dismiss(), DURATION)
  }, [dismiss])

  const setOnScreen = useCallback((v) => {
    live.current.shown = v
    setShown(v)
  }, [])

  // Place the dock, then ask whether the card can be seen. Seen and
  // waiting → show it and start a full clock. Covered and showing →
  // stop the clock and wait.
  const check = useCallback(() => {
    const dock = dockRef.current
    const card = cardRef.current
    const s = live.current
    if (!dock || !card || s.leaving || s.held) return
    const bottom = dockOffset(dock)
    if (dock.style.bottom !== bottom) dock.style.bottom = bottom
    const seen = hitsOwn(card)
    if (seen && !s.shown) {
      setOnScreen(true)
      setRun(n => n + 1)
      arm()
    } else if (!seen && s.shown) {
      clearTimeout(timerRef.current)
      setOnScreen(false)
    }
  }, [arm, setOnScreen])

  // A new head: start hidden and let check() decide, before the first
  // paint, whether it can show now. The same head bumped by a merged
  // repeat: a fresh clock if it is showing (including mid-exit, so a
  // repeat that lands while the card is leaving is not swallowed).
  useLayoutEffect(() => {
    if (!current) { live.current.id = null; return undefined }
    const sameHead = live.current.id === current.id
    live.current.id = current.id
    live.current.leaving = false
    live.current.held = false
    setLeaving(false); setExitDir(null); setDrag(null); setHeld(false)
    clearTimeout(exitRef.current)
    if (sameHead && live.current.shown) arm()
    else {
      clearTimeout(timerRef.current)
      setOnScreen(false)
    }
    check()
    return undefined
  }, [current?.id, current?.bumpAt, arm, check, setOnScreen]) // eslint-disable-line react-hooks/exhaustive-deps

  // While there is a head, watch the page: a cover opening or closing,
  // the bars moving, the viewport changing.
  const hasHead = !!current
  useEffect(() => {
    if (!hasHead) return undefined
    return watchLayers(check, { ignore: () => dockRef.current })
  }, [hasHead, check])

  useEffect(() => () => { clearTimeout(timerRef.current); clearTimeout(exitRef.current) }, [])

  if (!current || typeof document === 'undefined') return null

  // ── Touch: hold pauses, tap dismisses, a swipe flings it away ──
  const onPointerDown = (e) => {
    if (leaving || !shown) return
    startRef.current = { x: e.clientX, y: e.clientY, moved: false }
    clearTimeout(timerRef.current)
    live.current.held = true
    setHeld(true)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e) => {
    const s = startRef.current
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) s.moved = true
    if (s.moved) setDrag({ dx, dy: Math.max(0, dy) })
  }
  const release = (e, cancelled) => {
    const s = startRef.current
    startRef.current = null
    live.current.held = false
    setHeld(false)
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (!cancelled && !s.moved) { dismiss(); return }
    if (!cancelled && Math.abs(dx) > 64) { setDrag(null); dismiss(dx > 0 ? 'right' : 'left'); return }
    if (!cancelled && dy > 32) { setDrag(null); dismiss(); return }
    setDrag(null)
    setRun(n => n + 1)
    arm()
  }

  const pending = queue.length - 1

  // Follows the finger 1:1 sideways and downward; no fading while held,
  // so the text never sits translucent over the page beneath it.
  const dragStyle = drag && !leaving
    ? { transform: `translate(${drag.dx}px, ${drag.dy}px)` }
    : undefined

  return createPortal(
    <div
      ref={dockRef}
      className={cx('sys-toast-dock', urgent && 'is-urgent')}
      role={urgent ? 'alert' : 'status'}
      aria-live={urgent ? 'assertive' : 'polite'}
      data-testid="system-alert"
      data-state={shown ? 'shown' : 'waiting'}
    >
      <div className="sys-toast-wrap">
        <div
          ref={cardRef}
          key={current.id}
          className={cx(
            'sys-toast', `sys-tone-${tone}`,
            !shown && 'is-waiting',
            drag && 'is-dragging', held && 'is-held',
            leaving && 'is-leaving', leaving && exitDir && `to-${exitDir}`,
          )}
          style={dragStyle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => release(e, false)}
          onPointerCancel={(e) => release(e, true)}
          title="اضغط أو اسحب للإخفاء"
        >
          {glyph && (
            <span className="sys-toast-icon">
              <Glyph glyph={glyph} size={22} weight={glyph.Icon ? 'fill' : undefined} />
            </span>
          )}
          <span className="sys-toast-msg">{isolateRuns(String(current.msg ?? ''))}</span>
          {current.count > 1 && (
            <span className="sys-toast-count" aria-label={`${current.count} مرات`}><Num>×{current.count}</Num></span>
          )}
          {shown && (
            <i
              key={`${current.bumpAt}-${run}`}
              className="sys-toast-drain"
              style={{ animationDuration: `${DURATION}ms` }}
              aria-hidden="true"
            />
          )}
        </div>
        {pending > 0 && shown && <span className="sys-toast-stack" aria-hidden="true" />}
      </div>
    </div>,
    document.body,
  )
}
