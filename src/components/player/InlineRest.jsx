import { useEffect, useRef, useState } from 'react'
import { Num } from '../kit/index.jsx'
import { Timer } from '../kit/icons.js'
import { ls } from '../../utils.js'
import { primeAudio, audioPrimed, scheduleRestTones, chimeNow } from './sessionAudio.js'
import { restClock } from './sessionWords.js'

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
// Sound: tones scheduled on the shared AudioContext the moment the rest
// starts (primed by the tap that started it), rescheduled on ±15.

function read() {
  return ls.get(STORE, null)
}

const DEFAULT_SECONDS = 90

export default function InlineRest({ onDone, onSkip, seconds = DEFAULT_SECONDS, hidden = false }) {
  const [, force] = useState(0)
  const liveRef = useRef(false)      // saw a positive count while mounted

  // Whoever renders the rest owns starting the clock. Seeding only when
  // absent keeps a rest started elsewhere ticking untouched.
  useEffect(() => {
    if (!read()) ls.set(STORE, { selected: seconds, endsAt: Date.now() + seconds * 1000 })
    force(n => n + 1)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
  // a running animation would make it jump.
  const drainKey = st ? `${st.endsAt}|${st.selected}|${st.pausedLeft}` : ''
  const drain = useRef({ key: null, total: 1, delay: 0 })
  if (drain.current.key !== drainKey) {
    const total = Math.max(st?.selected || 0, msLeft / 1000, 1)
    drain.current = { key: drainKey, total, delay: -(total - msLeft / 1000) }
  }

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
    try { navigator.vibrate?.([180, 80, 180]) } catch {}
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

  if (finished) {
    return (
      <button type="button" className="s-ready" data-testid="rest-ready" hidden={hidden}
        onClick={() => { primeAudio(); ls.remove(STORE); onDone?.() }}>
        <span className="s-ready-title">جاهز · المجموعة التالية</span>
        <span className="s-ready-over">
          {overtime > 0 ? <>راحتك زادت <Num>+{restClock(overtime)}</Num></> : 'اضغط للبدء'}
        </span>
      </button>
    )
  }

  const paused = st.pausedLeft != null

  return (
    <div className="s-rest" data-testid="rest-bar" role="timer" aria-label="الراحة" hidden={hidden}>
      <div className="s-rest-top">
        <span className="s-rest-label"><Timer size={16} weight="bold" aria-hidden="true" />راحة</span>
        <button type="button" className="s-rest-skip" onClick={skip}>تخطي</button>
      </div>
      <div className="s-rest-main">
        <Num className="s-rest-time">{restClock(left)}</Num>
        <div className="s-rest-nudges">
          <button type="button" className="s-rest-nudge" aria-label="أنقص 15 ثانية" onClick={() => nudge(-15)}>
            <Num>−15</Num>
          </button>
          <button type="button" className="s-rest-nudge" aria-label="زد 15 ثانية" onClick={() => nudge(15)}>
            <Num>+15</Num>
          </button>
        </div>
      </div>
      <div className="s-rest-bar" aria-hidden="true">
        <i key={drainKey}
          style={{
            animationDuration: `${drain.current.total}s`,
            animationDelay: `${drain.current.delay}s`,
            animationPlayState: paused ? 'paused' : 'running',
          }} />
      </div>
    </div>
  )
}
