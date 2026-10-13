// ── The month as a story ──────────────────────────────────────
// The first time a month's report opens, it plays as a story: one card
// at a time, each turning by itself after about six seconds, with the
// strips across the top showing where he is. حمزة chose «تتقلب لحالها».
//
//   tap the left of the screen  — the next card (time runs right to left)
//   tap the right 30%           — the card before
//   press and hold              — pause, for as long as the finger stays
//   pull down                   — close the report
//   «تخطّي»                     — straight to the summary
//
// Touching anything on a card (the slider, «طبّقها على خطتي», «شارك»)
// stops the clock on that card, so it does not turn under his finger.
// After the last card — or «تخطّي» — the summary page opens.
//
// Reduced motion: nothing turns by itself and nothing moves; the cards
// change with a fade, and the taps still work.

import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Pause } from '../kit/icons.js'
import { CARDS } from './cards/Cards.jsx'
import { grainUrl } from './cards/bits.jsx'
import { CARD_MS } from '../../reportStory.js'
import { useReducedMotion } from '../../hooks/useMotion.js'

const HOLD_MS = 240        // a press longer than this is a hold, not a tap
const CLOSE_PX = 96        // pulled down this far closes
const CONTROL = 'button, a, input, select, textarea, [role="slider"], .ba, .rs-undo'

export default function Story({ report, cards, ctx, onDone, onClose }) {
  const reduced = useReducedMotion()
  const [i, setI] = useState(0)
  const [run, setRun] = useState(0)
  const [held, setHeld] = useState(false)
  const [stopped, setStopped] = useState(false)
  const [pull, setPull] = useState(0)
  const stage = useRef(null)
  const press = useRef(null)
  const id = cards[i]
  const dur = CARD_MS[id] || 0
  const auto = !reduced && dur > 0 && !stopped

  const go = useCallback((n) => {
    if (n >= cards.length) { onDone?.('end'); return }
    setI(Math.max(0, n))
    setRun(r => r + 1)
    setStopped(false)
  }, [cards.length, onDone])
  const next = useCallback(() => go(i + 1), [go, i])
  const prev = useCallback(() => go(i - 1), [go, i])

  // Keys: ← is the next card in a right-to-left story, → the one before,
  // space holds. Escape belongs to the report (it closes).
  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.closest?.('[role="slider"], input, textarea')) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); next() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); prev() }
      else if (e.key === ' ' && !e.target?.closest?.('button')) { e.preventDefault(); setHeld(h => !h) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev])

  // Leaving the app pauses; coming back carries on.
  useEffect(() => {
    const onVis = () => setHeld(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const onPointerDown = (e) => {
    if (e.button != null && e.button !== 0) return
    if (e.target.closest(CONTROL)) { setStopped(true); return }
    const p = { x: e.clientX, y: e.clientY, id: e.pointerId, hold: false, drag: false }
    p.timer = setTimeout(() => { p.hold = true; setHeld(true) }, HOLD_MS)
    press.current = p
    try { stage.current.setPointerCapture(e.pointerId) } catch {}
  }
  const onPointerMove = (e) => {
    const p = press.current
    if (!p || p.id !== e.pointerId) return
    const dx = e.clientX - p.x, dy = e.clientY - p.y
    if (!p.drag && dy > 12 && dy > Math.abs(dx) * 1.2) {
      p.drag = true
      clearTimeout(p.timer)
    }
    if (p.drag) setPull(Math.max(0, dy))
  }
  const end = (e, cancelled = false) => {
    const p = press.current
    if (!p || p.id !== e.pointerId) return
    press.current = null
    clearTimeout(p.timer)
    if (p.drag) {
      const dy = e.clientY - p.y
      setPull(0)
      if (!cancelled && dy > CLOSE_PX) onClose?.()
      return
    }
    if (p.hold) { setHeld(false); return }
    if (cancelled) return
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 12) return
    const r = stage.current.getBoundingClientRect()
    if (e.clientX > r.left + r.width * 0.7) prev()
    else next()
  }

  const Card = CARDS[id]
  const paused = held || pull > 0
  return (
    <div className={`rs-story${paused ? ' paused' : ''}${stopped ? ' stopped' : ''}`}
      role="region" aria-roledescription="قصة" aria-label={`تقرير ${report.monthLabel}، بطاقة ${i + 1} من ${cards.length}`}
      data-card-now={id}>
      <div ref={stage} className="rs-stage"
        style={{
          '--rs-grain': grainUrl() || undefined,
          ...(pull ? { transform: `translateY(${pull * 0.6}px) scale(${Math.max(0.9, 1 - pull / 2400)})`, opacity: Math.max(0.4, 1 - pull / 500), transition: 'none' } : null),
        }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={(e) => end(e)} onPointerCancel={(e) => end(e, true)}
        onContextMenu={(e) => e.preventDefault()}>
        <div className="rs-segs" aria-hidden="true">
          {cards.map((c, k) => {
            const on = k === i
            const cls = k < i ? ' done' : on ? (auto ? ' on' : dur ? ' still' : ' done') : ''
            return (
              <span key={c} className={`rs-seg${cls}`} style={on ? { '--dur': `${dur}ms` } : undefined}>
                <i key={on ? run : undefined} onAnimationEnd={on && auto ? () => { if (!held) next() } : undefined} />
              </span>
            )
          })}
        </div>
        <div className="rs-top">
          <button type="button" className="rs-x" onClick={onClose} aria-label="إغلاق التقرير"><X size={24} aria-hidden="true" /></button>
          <button type="button" className="rs-skip" onClick={() => onDone?.('skip')}>تخطّي</button>
        </div>
        {Card && <Card key={run} report={report} playing story ctx={ctx} />}
        <span className="rs-pausemark" aria-hidden="true"><span><Pause size={26} weight="fill" /></span></span>
        <button type="button" className="rs-sr-btn prev" onClick={prev}>البطاقة اللي قبل</button>
        <button type="button" className="rs-sr-btn next" onClick={next}>{i === cards.length - 1 ? 'الملخص' : 'البطاقة اللي بعدها'}</button>
      </div>
    </div>
  )
}
