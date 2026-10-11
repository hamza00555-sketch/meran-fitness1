import { useLayoutEffect, useRef, useState } from 'react'
import { animate, reducedMotion, rollColumns } from '../motion.js'

// ── A number that rolls like an odometer ──────────────────────
//
// Each digit that changes slides out of its window as the new one slides
// in — up when the number grows, down when it shrinks — the last digit
// first, the others following `stagger` ms apart. Digits that stay the
// same don't move. Integer and decimal parts line up on the point, so
// 75 → 77.5 rolls the 5 into a 7 and brings «.5» in beside it; a window
// that appears or empties grows or shrinks with its digit, so the number
// re-centres smoothly and lands exactly where the plain text sits.
//
// The final text is always in the layout (invisible while rolling), so
// the number never changes size under its neighbours, and once the roll
// lands it is plain text again. Reduced motion: the final number, still.
//
// Born from the level-up screen's Roll (LevelUpScreen.jsx), which now
// uses it.
//
// Props: from, to; delay (ms); stagger (ms between digits, default 40);
// spring (a name from motion.js, default 'snappy') or duration + easing;
// up (force the direction); onDone; className.

const num = (s) => parseFloat(String(s).replace(',', '.'))

export default function RollNumber({
  from, to, delay = 0, stagger = 40, spring = 'snappy', duration = null, easing = null,
  up = null, onDone, className = '', style,
}) {
  const a = String(from ?? '')
  const b = String(to ?? '')
  const key = `${a}→${b}`
  const [landed, setLanded] = useState(() => a === b ? key : null)
  const box = useRef(null)
  const done = useRef(onDone)
  done.current = onDone
  const rolling = landed !== key

  useLayoutEffect(() => {
    if (!rolling) return
    const el = box.current
    if (!el || reducedMotion()) { setLanded(key); done.current?.(); return }
    const goingUp = up != null ? up : !(num(b) < num(a))
    const opts = duration != null ? { d: duration, e: easing || undefined } : { spring }
    const windows = [...el.querySelectorAll('.k-roll-w')]
    const n = windows.length
    const anims = []
    windows.forEach((w, i) => {
      const strip = w.firstElementChild
      if (!strip || !strip.classList.contains('k-roll-s')) return
      const at = delay + (n - 1 - i) * stagger
      const kf = goingUp
        ? [{ transform: 'translateY(0)' }, { transform: 'translateY(-50%)' }]
        : [{ transform: 'translateY(-50%)' }, { transform: 'translateY(0)' }]
      anims.push(animate(strip, kf, { ...opts, delay: at }))
      // The window grows or shrinks between the two glyphs' widths.
      const [g1, g2] = strip.children
      const wa = (goingUp ? g1 : g2).getBoundingClientRect().width
      const wb = (goingUp ? g2 : g1).getBoundingClientRect().width
      if (Math.abs(wa - wb) > 0.5) anims.push(animate(w, [{ width: `${wa}px` }, { width: `${wb}px` }], { ...opts, delay: at }))
    })
    const live = anims.filter(Boolean)
    if (!live.length) { setLanded(key); done.current?.(); return }
    let alive = true
    Promise.all(live.map(x => x.finished)).then(() => {
      if (!alive) return
      setLanded(key)
      done.current?.()
    }, () => {})
    return () => { alive = false; live.forEach(x => { try { x.cancel() } catch {} }) }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!rolling) {
    return <span className={`k-roll ${className}`} style={style}>{b}</span>
  }
  // The ghost is the final number in transparent ink: it holds the size
  // and is what a screen reader reads; the moving digits are hidden from it.
  const goingUp = up != null ? up : !(num(b) < num(a))
  return (
    <span className={`k-roll k-roll-on ${className}`} style={style} ref={box}>
      <span className="k-roll-ghost">{b}</span>
      <span className="k-roll-o" aria-hidden="true">
        {rollColumns(a, b).map(([x, y], i) => {
          const X = x === ' ' ? '' : x
          const Y = y === ' ' ? '' : y
          if (x === y) return <span key={i} className="k-roll-w">{Y}</span>
          return (
            <span key={i} className="k-roll-w">
              <span className="k-roll-s">
                {goingUp ? <><span>{X}</span><span>{Y}</span></> : <><span>{Y}</span><span>{X}</span></>}
              </span>
            </span>
          )
        })}
      </span>
    </span>
  )
}
