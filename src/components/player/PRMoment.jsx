import { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Trophy } from '../kit/icons.js'
import { Num } from '../kit/index.jsx'
import RollNumber from '../RollNumber.jsx'
import { animate, reducedMotion, rise, fadeIn, EASE } from '../../motion.js'
import { kg } from './sessionWords.js'
import '../../styles/screens/pr.css'

// ── رقم قياسي جديد ────────────────────────────────────────────
//
// The moment a set beats every weight on record for this exercise
// (WorkoutPlayer's one definition: the row turns gold in the same
// render). حمزة chose the full version, «كاملة بالقصاصات»:
//
//        0ms  the phone buzzes twice and the sound plays (in the tap,
//             before this mounts); the screen dims
//       60ms  a gold shock ring leaves the centre
//      100ms  the trophy drops in on a spring
//      180ms  gold confetti from both sides, a softer burst at 420ms
//      260ms  «رقم قياسي جديد»; the weight rolls from the old best at 360ms
//      760ms  «+5 كجم فوق أعلى وزن قبل», then the exercise's name
//     1000ms  a sheen crosses the number
//     2300ms  the trophy flies into the set's row and lands there; the
//             row flashes gold (WorkoutPlayer does the landing)
//
// It never stops the session: the rest is already counting underneath,
// and one tap anywhere jumps to the landing. It holds the touch only for
// that. Big once per exercise per session — a second record in the same
// exercise is the small flash on the row, decided by WorkoutPlayer.
//
// Reduced motion (the phone's setting): no confetti, no shock ring, no
// flight; the card fades in with the numbers already there, and fades out.
// The buzz and the sound stay.
//
// The confetti is canvas-confetti, loaded only when a record happens.

const GOLDS = ['#FBBF24', '#FDE68A', '#F59E0B', '#FFFFFF']
const FLY_AT = 2300

export default function PRMoment({ from, to, name, findTarget, onLand }) {
  const rootRef = useRef(null)
  const stageRef = useRef(null)
  const troRef = useRef(null)
  const flyRef = useRef(null)
  const numRef = useRef(null)
  const canvasRef = useRef(null)
  const state = useRef({ landed: false, timers: [], conf: null, alive: true })
  const land = useRef(onLand)
  land.current = onLand
  const find = useRef(findTarget)
  find.current = findTarget

  const delta = Math.round((to - from) * 100) / 100

  const finish = (skip) => {
    const st = state.current
    if (st.landed) return
    st.landed = true
    st.timers.forEach(clearTimeout)
    try { if (skip) st.conf?.reset?.() } catch {}
    const root = rootRef.current
    if (root) root.style.pointerEvents = 'none'
    const done = () => { if (state.current.alive) land.current?.() }
    const fade = animate(stageRef.current, [{ opacity: 1 }, { opacity: 0 }], { d: 300, e: EASE.exit, fill: 'forwards' })
    animate(canvasRef.current, [{ opacity: 1 }, { opacity: 0 }], { d: 300, e: EASE.exit, fill: 'forwards' })

    const tro = troRef.current, fly = flyRef.current
    const target = reducedMotion() ? null : find.current?.()
    if (tro && fly && target) {
      const a = tro.getBoundingClientRect()
      const b = target.getBoundingClientRect()
      Object.assign(fly.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`, opacity: '1' })
      tro.style.visibility = 'hidden'
      const dx = (b.left + b.width / 2) - (a.left + a.width / 2)
      const dy = (b.top + b.height / 2) - (a.top + a.height / 2)
      const s = a.width ? b.width / a.width : 1
      const flight = animate(fly, [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${s})` }],
        skip ? { d: 260, e: EASE.out, fill: 'forwards' } : { spring: 'smooth', fill: 'forwards' })
      if (flight?.finished) flight.finished.then(done, done)
      else done()
      return
    }
    if (fade?.finished) fade.finished.then(done, done)
    else done()
  }

  useLayoutEffect(() => {
    const st = state.current
    const at = (ms, fn) => st.timers.push(setTimeout(() => { if (st.alive && !st.landed) fn() }, ms))
    const reduce = reducedMotion()

    if (reduce) {
      animate(rootRef.current, fadeIn, { d: 200, e: 'linear' })
      at(1800, () => finish(false))
      return
    }

    animate(rootRef.current.querySelector('.pr-scrim'), fadeIn, { d: 200 })
    animate(rootRef.current.querySelector('.pr-shock'),
      [{ opacity: 0.9, transform: 'scale(.3)' }, { opacity: 0, transform: 'scale(2.6)' }],
      { d: 700, delay: 60, e: 'cubic-bezier(.2,.8,.3,1)' })
    animate(troRef.current,
      [{ opacity: 0, transform: 'translateY(-24px) scale(.4) rotate(-10deg)' }, { opacity: 1, transform: 'none' }],
      { spring: 'bouncy', delay: 100 })
    const q = (s) => rootRef.current.querySelector(s)
    animate(q('.pr-eb'), rise(8), { d: 240, delay: 260 })
    animate(q('.pr-w'), fadeIn, { d: 180, delay: 300 })
    animate(q('.pr-sub'), rise(6), { d: 240, delay: 760 })
    animate(q('.pr-name'), fadeIn, { d: 240, delay: 820 })
    animate(q('.pr-hint'), fadeIn, { d: 300, delay: 1300 })
    at(1000, () => {
      // On the number's own text (background-clip: text skips the text of
      // positioned children, and the rolled number is one).
      const n = numRef.current?.querySelector('.k-roll') || numRef.current
      if (!n) return
      n.classList.add('s-gt')
      const a = animate(n, [{ backgroundPosition: '100% 0' }, { backgroundPosition: '0% 0' }], { d: 700, e: EASE.io, fill: 'none' })
      a?.finished?.then(() => n.classList.remove('s-gt'), () => {})
    })

    // Confetti: two bursts from the sides, a softer one from the trophy.
    const t0 = performance.now()
    const bursts = []
    const fire = () => {
      const c = st.conf
      if (!c) return
      const base = { particleCount: 42, spread: 58, startVelocity: 44, gravity: 1.05, ticks: 170, scalar: 0.95, colors: GOLDS, disableForReducedMotion: true }
      while (bursts.length) {
        const b = bursts.shift()
        try {
          if (b === 'sides') {
            c({ ...base, angle: 62, origin: { x: 0.08, y: 0.66 } })
            c({ ...base, angle: 118, origin: { x: 0.92, y: 0.66 } })
          } else {
            c({ particleCount: 26, spread: 100, startVelocity: 30, gravity: 1.1, ticks: 160, scalar: 0.8,
              origin: { x: 0.5, y: 0.36 }, colors: [GOLDS[0], GOLDS[1], GOLDS[3]], disableForReducedMotion: true })
          }
        } catch {}
      }
    }
    import('canvas-confetti').then((m) => {
      if (!st.alive || st.landed || !canvasRef.current) return
      try {
        st.conf = m.default.create(canvasRef.current, { resize: true, useWorker: false, disableForReducedMotion: true })
      } catch { return }
      // Late (a cold cache): only what is still worth seeing.
      if (performance.now() - t0 < 900) fire()
    }, () => {})
    at(180, () => { bursts.push('sides'); fire() })
    at(420, () => { bursts.push('centre'); fire() })
    at(FLY_AT, () => finish(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const st = state.current
    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish(true) } }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      st.alive = false
      st.timers.forEach(clearTimeout)
      try { st.conf?.reset?.() } catch {}
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(
    <div className="pr" ref={rootRef} data-testid="pr-moment" role="status" aria-live="assertive"
      onClick={(e) => { e.stopPropagation(); finish(true) }}>
      <div className="pr-stage" ref={stageRef}>
        <div className="pr-scrim" />
        <div className="pr-shock" />
        <div className="pr-body">
          <span className="pr-tro" ref={troRef}><Trophy size={84} weight="fill" aria-hidden="true" /></span>
          <div className="pr-eb">رقم قياسي جديد</div>
          <div className="pr-w">
            <span className="pr-num" ref={numRef}><RollNumber from={kg(from)} to={kg(to)} delay={360} stagger={50} /></span>
            <span className="pr-u">كجم</span>
          </div>
          {delta > 0 && (
            <div className="pr-sub"><b><Num>+{kg(delta)}</Num></b> كجم فوق أعلى وزن قبل</div>
          )}
          {name && <div className="pr-name">{name}</div>}
        </div>
        <div className="pr-hint">اضغط في أي مكان للإكمال</div>
      </div>
      <canvas className="pr-conf" ref={canvasRef} aria-hidden="true" />
      <span className="pr-fly" ref={flyRef} aria-hidden="true"><Trophy size={84} weight="fill" /></span>
    </div>,
    document.body,
  )
}
