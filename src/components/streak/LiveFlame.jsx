import { useLayoutEffect, useRef, useState } from 'react'
import { Flame as PFlame } from '../kit/icons.js'
import { animate, reducedMotion, EASE } from '../../motion.js'
import '../../styles/flame.css'

// ── The streak's flame, alive ─────────────────────────────────
//
// Filled once today counts, an outline while today is still owed — the
// same state StreakIcons' Flame has always shown. Two things on top:
//
//   sway    it moves, gently, all the time (حمزة: «يتحرك بهدوء
//           دايماً»): a slow lean and a quicker flicker on two nested
//           layers with different periods, so it never visibly repeats.
//           Transform only, on the compositor. Still under reduced motion.
//   ignite  the flame fills with orange from the bottom up (520ms), hops,
//           and three small embers leave its tip. Under reduced motion it
//           is simply filled. `skip` jumps to the end.
//
// Embers and all, it stays inside its own box: nothing is added around
// the number on Home.

const EMBERS = [[-7, -17, 4], [2, -24, 3], [8, -15, 3.5]]

export default function LiveFlame({ size = 24, filled = false, ignite = false, sway = false, skip = false, className = '' }) {
  const box = useRef(null)
  const fill = useRef(null)
  const anims = useRef([])
  const [burning, setBurning] = useState(false)

  useLayoutEffect(() => {
    // already skipped (a tap landed everything): simply filled
    if (!ignite || !filled || skip || reducedMotion()) return
    const a = []
    const add = (x) => { if (x) a.push(x) }
    setBurning(true)
    const f = animate(fill.current, [{ clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)' }], { d: 520, e: EASE.out })
    add(f)
    add(animate(box.current, [
      { transform: 'none' }, { transform: 'translateY(-3px) scale(1.18)', offset: 0.35 }, { transform: 'none' },
    ], { d: 520, delay: 470, e: EASE.out }))
    box.current?.querySelectorAll('.lf-ember').forEach((el, i) => {
      const [dx, dy] = EMBERS[i]
      add(animate(el, [
        { opacity: 0, transform: 'translate(0, 0) scale(1)' },
        { opacity: 1, offset: 0.15 },
        { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(.35)` },
      ], { d: 720, delay: 500 + i * 80, e: EASE.out }))
    })
    anims.current = a
    let alive = true
    const done = () => { if (alive) setBurning(false) }
    if (f?.finished) f.finished.then(done, done)
    else done()
    return () => { alive = false; a.forEach(x => { try { x.cancel() } catch {} }); anims.current = []; setBurning(false) }
  }, [ignite, filled]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (skip) anims.current.forEach(x => { try { x.finish() } catch {} })
  }, [skip])

  return (
    <span ref={box} className={`lf${sway ? ' lf-sway' : ''}${className ? ' ' + className : ''}`} aria-hidden="true">
      <span className="lf-a"><span className="lf-b">
        {(!filled || burning) && <PFlame size={size} weight="regular" className="lf-hollow" />}
        {filled && <span ref={fill} className="lf-fill"><PFlame size={size} weight="fill" /></span>}
      </span></span>
      {ignite && filled && EMBERS.map(([, , s], i) => (
        <i key={i} className="lf-ember" style={{ width: s, height: s, marginLeft: -s / 2 }} />
      ))}
    </span>
  )
}
