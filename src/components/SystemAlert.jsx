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
//   · the queue API is unchanged: `alerts` is the queue, the head is
//     shown, `onRemove()` drops the head; a merged repeat (same icon)
//     bumps the timer and shows ×N.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Warning } from '@phosphor-icons/react'
import { Num } from './kit/index.jsx'
import { resolveGlyph, Glyph, isolateRuns } from './system/glyphs.jsx'
import '../styles/screens/system.css'

const DURATION = 3200 // ms on screen
const EXIT     = 170  // ms for the way out
const GAP      = 12   // px above whatever is docked at the bottom

const cx = (...a) => a.filter(Boolean).join(' ')

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** How far from the bottom the toast sits: just above the highest bar
 *  docked at the bottom of the screen (the tab bar, the live bar, or
 *  anything marked data-toast-avoid). null → the CSS fallback. */
function dockOffset() {
  if (typeof document === 'undefined') return null
  const vh = window.innerHeight
  let top = Infinity
  document.querySelectorAll('.f-tabs, .f-livebar, [data-toast-avoid]').forEach(el => {
    const r = el.getBoundingClientRect()
    if (r.height > 0 && r.top > vh * 0.5 && r.top < vh) top = Math.min(top, r.top)
  })
  return Number.isFinite(top) ? Math.round(vh - top + GAP) : null
}

export default function SystemAlert({ alerts: queue, onRemove }) {
  const current = queue[0]

  const [leaving, setLeaving] = useState(false)
  const [exitDir, setExitDir] = useState(null)      // 'left' | 'right' | null
  const [drag, setDrag]       = useState(null)      // { dx, dy } while a finger is on it
  const [held, setHeld]       = useState(false)
  const [run, setRun]         = useState(0)         // restarts the drain after a hold
  const [dock, setDock]       = useState(null)

  const timerRef  = useRef(null)
  const exitRef   = useRef(null)
  const startRef  = useRef(null)
  const removeRef = useRef(onRemove)
  removeRef.current = onRemove

  const dismiss = useCallback((dir = null) => {
    clearTimeout(timerRef.current)
    clearTimeout(exitRef.current)
    setExitDir(dir)
    setLeaving(true)
    exitRef.current = setTimeout(() => removeRef.current?.(), reducedMotion() ? 0 : EXIT)
  }, [])

  const arm = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => dismiss(), DURATION)
  }, [dismiss])

  // A new head, or the same head bumped by a merged repeat: show it
  // fresh and start the clock again — including mid-exit, so a repeat
  // that lands while the card is leaving is not swallowed with it.
  useEffect(() => {
    if (!current) return
    setLeaving(false); setExitDir(null); setDrag(null); setHeld(false)
    clearTimeout(exitRef.current)
    arm()
    return () => { clearTimeout(timerRef.current); clearTimeout(exitRef.current) }
  }, [current?.id, current?.bumpAt, arm])

  // Measure where the bottom bars are each time a new card shows.
  useLayoutEffect(() => {
    if (!current) return
    const measure = () => setDock(dockOffset())
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [current?.id])

  if (!current || typeof document === 'undefined') return null

  // ── Touch: hold pauses, tap dismisses, a swipe flings it away ──
  const onPointerDown = (e) => {
    if (leaving) return
    startRef.current = { x: e.clientX, y: e.clientY, moved: false }
    clearTimeout(timerRef.current)
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

  const glyph = resolveGlyph(current.icon)
  let tone = glyph?.tone || 'neutral'
  // A warning about the streak is the streak's to colour.
  if (glyph?.Icon === Warning && /ستريك/.test(String(current.msg || ''))) tone = 'streak'
  const urgent = tone === 'danger'
  const pending = queue.length - 1

  // Follows the finger 1:1 sideways and downward; no fading while held,
  // so the text never sits translucent over the page beneath it.
  const dragStyle = drag && !leaving
    ? { transform: `translate(${drag.dx}px, ${drag.dy}px)` }
    : undefined

  return createPortal(
    <div
      className="sys-toast-dock"
      style={dock != null ? { bottom: dock } : undefined}
      role={urgent ? 'alert' : 'status'}
      aria-live={urgent ? 'assertive' : 'polite'}
      data-testid="system-alert"
    >
      <div className="sys-toast-wrap">
        <div
          key={current.id}
          className={cx(
            'sys-toast', `sys-tone-${tone}`,
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
          <i
            key={`${current.bumpAt}-${run}`}
            className="sys-toast-drain"
            style={{ animationDuration: `${DURATION}ms` }}
            aria-hidden="true"
          />
        </div>
        {pending > 0 && <span className="sys-toast-stack" aria-hidden="true" />}
      </div>
    </div>,
    document.body,
  )
}
