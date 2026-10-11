import { useEffect, useRef, useState } from 'react'
import { Num } from '../kit/index.jsx'
import { Timer } from '../kit/icons.js'
import { ls } from '../../utils.js'
import { primeAudio, audioPrimed, scheduleRestTones, chimeNow } from './sessionAudio.js'
import { restClock } from './sessionWords.js'
import { haptic } from '../../haptics.js'
import RollNumber from '../RollNumber.jsx'
import { animate, reducedMotion, EASE, FINAL_SECONDS, isRestFinal, restTintDelay } from '../../motion.js'

const STORE = 'hf_rest_timer'

// ── Rest takes the docked button's place ──────────────────────
//
// Reads and writes exactly what the floating RestTimer does — selected,
// endsAt, pausedLeft in hf_rest_timer — so a rest started anywhere
// continues here and vice versa, and the old design reads it too.
// Wall-clock driven: a phone locked mid-rest comes back with the truth.
//
// While counting: «راحة» in the rest blue, the time at 56px, −15/+15 at
// 44pt, «تخطي» as plain grey text (skipping is ordinary, never red), and
// a 4px blue bar draining from the start edge — one CSS animation per
// rest, so it moves smoothly without a render per frame.
//
// At zero it does not dismiss itself. It wipes into a full-width green
// field, «جاهز · المجموعة التالية», that waits for a tap — the signal
// stays until you look up — and counts the overtime, «+0:23».
//
// Sound: the library's tick (−3/−2/−1s) and end chime, scheduled on the
// shared AudioContext the moment the rest starts (primed by the tap that
// started it), rescheduled on ±15 (sessionAudio.js). They follow the
// phone's silent switch (sound.js) — there is no other on/off.
//
// Motion (the plan's «اقتراح 1», phase 3):
//   · every second the time rolls like an odometer (220ms) — down as it
//     counts, up on +15;
//   · the last three seconds (data-final): with each tick the number
//     pulses (1 → 1.12 → 1, 320ms) and a soft blue wave leaves the panel
//     (650ms), and the bar turns from the rest blue to the green of the
//     «جاهز» that is coming, linearly over those 3000ms;
//   · at zero «جاهز» wipes in from the start edge and its words settle.
// Reduced motion: no roll, no pulse, no wave; the bar's colour still
// says the end is near. The sounds and the buzz are not motion: they stay.

function read() {
  return ls.get(STORE, null)
}

const DEFAULT_SECONDS = 90
// How long the counted-down panel lingers under «جاهز» (its 320ms wipe).
const READY_OVERLAP_MS = 360

export default function InlineRest({ onDone, onSkip, seconds = DEFAULT_SECONDS, hidden = false, morph = false }) {
  const [, force] = useState(0)
  const liveRef = useRef(false)      // saw a positive count while mounted

  // Whoever renders the rest owns starting the clock. Seeding only when
  // absent keeps a rest started elsewhere ticking untouched. Seeded before
  // the first render, so the panel is there in the very commit of the tap
  // that started it (the button grows into it — WorkoutPlayer); the effect
  // is the backstop for a store that refused the write.
  useState(() => { if (!read()) ls.set(STORE, { selected: seconds, endsAt: Date.now() + seconds * 1000 }) })
  useEffect(() => {
    if (!read()) ls.set(STORE, { selected: seconds, endsAt: Date.now() + seconds * 1000 })
    force(n => n + 1)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // How the panel arrived, for its whole life: grown out of the button
  // (no fade of its own), or simply faded in.
  const [arrive] = useState(() => (morph ? 'morph' : null))
  // At zero the panel stays a moment under «جاهز» wiping in, fading.
  const [panelGone, setPanelGone] = useState(false)

  const st = read()
  const msLeft = st?.pausedLeft != null ? st.pausedLeft * 1000
    : st?.endsAt ? Math.max(0, st.endsAt - Date.now()) : 0
  const left = Math.ceil(msLeft / 1000)
  const finished = !!st && left === 0
  const overtime = finished && st?.endsAt ? Math.floor((Date.now() - st.endsAt) / 1000) : 0
  if (left > 0) liveRef.current = true

  // The drain: full width at the rest's length, shrinking toward the end
  // edge, started part-way through by a negative delay. Fixed per rest
  // (recomputed only when the end moves), because changing the delay of
  // a running animation would make it jump. Its tint — blue to green over
  // the last three seconds — is a second animation on the same clock.
  const drainKey = st ? `${st.endsAt}|${st.selected}|${st.pausedLeft}` : ''
  const drain = useRef({ key: null, total: 1, delay: 0, tint: 0 })
  if (drain.current.key !== drainKey) {
    const total = Math.max(st?.selected || 0, msLeft / 1000, 1)
    drain.current = { key: drainKey, total, delay: -(total - msLeft / 1000), tint: restTintDelay(msLeft) }
  }

  // The number the time rolls from: the one shown before this second.
  // (Idempotent across a double render: it only moves when `left` does.)
  const roll = useRef({ left: null, from: null })
  if (st && roll.current.left !== left) roll.current = { left, from: roll.current.left ?? left }
  const paused = st?.pausedLeft != null
  const final = isRestFinal(left, paused)

  // The last three seconds: a pulse and a wave with each tick.
  const timeRef = useRef(null)
  const waveRef = useRef(null)
  useEffect(() => {
    if (!final || hidden || reducedMotion()) return
    animate(timeRef.current, [
      { transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.35 }, { transform: 'scale(1)' },
    ], { d: 320, e: EASE.out, fill: 'none' })
    const wave = waveRef.current
    let rgb = '59,157,232'
    try { rgb = getComputedStyle(wave).getPropertyValue('--rest-rgb').trim() || rgb } catch {}
    animate(wave, [
      { opacity: 1, boxShadow: `0 0 0 0 rgba(${rgb}, 0.45)` },
      { opacity: 0, boxShadow: `0 0 0 14px rgba(${rgb}, 0)` },
    ], { d: 650, e: EASE.out, fill: 'none' })
  }, [left, final]) // eslint-disable-line react-hooks/exhaustive-deps

  // One render per whole second, aligned to the second boundary, plus a
  // resync whenever the app comes back to the front.
  useEffect(() => {
    let t = 0
    const tick = () => {
      force(n => n + 1)
      const s = read()
      const ms = s?.endsAt ? (s.endsAt - Date.now()) : 1000
      const next = ((ms % 1000) + 1000) % 1000 || 1000
      t = setTimeout(tick, Math.min(1000, next + 15))
    }
    t = setTimeout(tick, 250)
    const sync = () => force(n => n + 1)
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('pageshow', sync)
    return () => {
      clearTimeout(t)
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('pageshow', sync)
    }
  }, [])

  // The tones, scheduled ahead on the audio clock; redone when the end
  // moves (±15) and cancelled on skip or unmount.
  const endsAt = st?.pausedLeft == null ? st?.endsAt : null
  const scheduled = useRef(false)
  useEffect(() => {
    if (!endsAt) return
    const secs = (endsAt - Date.now()) / 1000
    if (secs <= 0 || !audioPrimed()) { scheduled.current = false; return }
    scheduled.current = true
    const cancel = scheduleRestTones(secs)
    return cancel
  }, [endsAt])

  // At zero: a buzz where the platform has one, and a chime if nothing
  // was scheduled (a rest started before any tap primed the audio).
  const firedRef = useRef(false)
  useEffect(() => {
    if (!finished) { firedRef.current = false; return }
    if (firedRef.current || !liveRef.current) return
    firedRef.current = true
    if (!scheduled.current) chimeNow()
    haptic('rest')
    const t = setTimeout(() => setPanelGone(true), READY_OVERLAP_MS)
    return () => clearTimeout(t)
  }, [finished])

  if (!st) return null

  const nudge = (delta) => {
    primeAudio()
    const cur = read()
    if (!cur) return
    if (cur.pausedLeft != null) {
      ls.set(STORE, { ...cur, pausedLeft: Math.max(0, cur.pausedLeft + delta) })
    } else {
      ls.set(STORE, { ...cur, endsAt: Math.max(Date.now(), (cur.endsAt || Date.now()) + delta * 1000) })
    }
    force(n => n + 1)
  }

  const skip = () => {
    ls.remove(STORE)
    onSkip?.()
  }

  // Counting down this panel's own rest to zero, it stays (the same node,
  // so the last second rolls to 0:00) under «جاهز» while that wipes in,
  // and fades: one moment becomes the next, with no empty frame between.
  const leaving = finished && liveRef.current && !panelGone && !hidden && !reducedMotion()
  const ready = finished ? (
    <button type="button" className="s-ready" data-testid="rest-ready" hidden={hidden}
      onClick={() => { primeAudio(); ls.remove(STORE); onDone?.() }}>
      {/* The green face wipes in; the button under it takes a tap from its
          first frame (a clip would hide it from the finger as well). */}
      <span className="s-ready-face">
        <span className="s-ready-title">جاهز · المجموعة التالية</span>
        <span className="s-ready-over">
          {overtime > 0 ? <>راحتك زادت <Num>+{restClock(overtime)}</Num></> : 'اضغط للبدء'}
        </span>
      </span>
    </button>
  ) : null
  if (finished && !leaving) return <>{null}{ready}</>

  return (
    <>
    <div className={leaving ? 's-rest s-rest-leaving' : 's-rest'} hidden={hidden}
      data-testid={leaving ? undefined : 'rest-bar'} role={leaving ? undefined : 'timer'}
      aria-label={leaving ? undefined : 'الراحة'} aria-hidden={leaving ? 'true' : undefined}
      data-final={final ? '1' : undefined} data-arrive={arrive || undefined}>
      <div className="s-rest-top">
        <span className="s-rest-label"><Timer size={16} weight="bold" aria-hidden="true" />راحة</span>
        <button type="button" className="s-rest-skip" onClick={skip}>تخطي</button>
      </div>
      <div className="s-rest-main">
        <bdi dir="ltr" className="k-num s-rest-time" ref={timeRef}>
          <RollNumber from={restClock(roll.current.from)} to={restClock(left)} up={left > roll.current.from}
            duration={220} easing={EASE.out} stagger={30} />
        </bdi>
        <div className="s-rest-nudges">
          <button type="button" className="s-rest-nudge" aria-label="أنقص 15 ثانية" onClick={() => nudge(-15)}>
            <Num>−15</Num>
          </button>
          <button type="button" className="s-rest-nudge" aria-label="زد 15 ثانية" onClick={() => nudge(15)}>
            <Num>+15</Num>
          </button>
        </div>
      </div>
      <div className="s-rest-bar" aria-hidden="true" key={drainKey}
        style={{
          animationDuration: `${FINAL_SECONDS}s`,
          animationDelay: `${drain.current.tint}s`,
          animationPlayState: paused ? 'paused' : 'running',
        }}>
        <i
          style={{
            animationDuration: `${drain.current.total}s, ${FINAL_SECONDS}s`,
            animationDelay: `${drain.current.delay}s, ${drain.current.tint}s`,
            animationPlayState: paused ? 'paused' : 'running',
          }} />
      </div>
    </div>
    {leaving ? ready : (
      <span className="s-rest-wave" ref={waveRef} aria-hidden="true" hidden={hidden} />
    )}
    </>
  )
}
