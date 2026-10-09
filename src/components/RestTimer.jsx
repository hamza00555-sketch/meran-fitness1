import { useState, useEffect, useRef } from 'react'
import { playBeep, ls } from '../utils.js'
import { REST_PRESETS } from '../constants.js'
import { IconButton, Button, Segmented, Num } from './kit/index.jsx'
import { Timer, Pause, Play, X } from './kit/icons.js'
import { chimeNow } from './player/sessionAudio.js'
import { restClock } from './player/sessionWords.js'
import '../styles/screens/session-sheets.css'

const STORE = 'hf_rest_timer'

// ── The rest, away from the player ────────────────────────────
//
// When the session is docked as the live bar and you wander to another
// tab mid-rest, this is the same clock (the same hf_rest_timer the
// player reads), docked above the live bar and the tabs — near the
// thumb, never over the top of the page — in the rest blue, with a bar
// draining from the start edge. Presets are a segmented control with
// 44pt targets; pause and close are 44pt icon buttons.
//
// The countdown is driven by wall-clock time, not by counting interval
// ticks: browsers suspend timers while the app is backgrounded, which
// used to freeze the rest timer until you came back. `endsAt` is an
// absolute timestamp, so time keeps passing while you're away — and the
// state is persisted so it survives the app being closed entirely.
const secondsLeft = (endsAt) => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))

const loadSaved = () => {
  const s = ls.get(STORE, null)
  if (!s || typeof s.selected !== 'number') return null
  if (s.pausedLeft == null && typeof s.endsAt !== 'number') return null
  return s
}

export default function RestTimer({ onClose }) {
  const saved = useRef(loadSaved()).current

  const [selected,   setSelected]   = useState(saved?.selected ?? 90)
  const [endsAt,     setEndsAt]     = useState(saved?.endsAt ?? Date.now() + (saved?.selected ?? 90) * 1000)
  const [pausedLeft, setPausedLeft] = useState(saved?.pausedLeft ?? null)
  const [, forceTick] = useState(0)
  const beepedRef = useRef(false)

  const remaining = pausedLeft != null ? pausedLeft : secondsLeft(endsAt)
  const done      = remaining === 0
  const running   = pausedLeft == null && !done

  // Persist so a suspended / relaunched app resumes the same countdown
  useEffect(() => {
    ls.set(STORE, { selected, endsAt, pausedLeft })
  }, [selected, endsAt, pausedLeft])

  // Re-read the clock 4×/second: keeps the display honest and makes it
  // snap to the correct value the instant the app is resumed.
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => forceTick(t => t + 1), 250)
    return () => clearInterval(id)
  }, [running])

  // Recompute the moment the app becomes visible again
  useEffect(() => {
    const sync = () => forceTick(t => t + 1)
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    window.addEventListener('pageshow', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('focus', sync)
      window.removeEventListener('pageshow', sync)
    }
  }, [])

  // Alert once when the rest ends — on return too, if it ended while away
  useEffect(() => {
    if (!done || beepedRef.current) return
    beepedRef.current = true
    if (!chimeNow()) playBeep(4)
    if (document.hidden) {
      navigator.serviceWorker?.ready
        .then(reg => reg.showNotification('انتهت الراحة', {
          body: 'ارجع للتمرين — المجموعة التالية جاهزة.',
          icon: '/icon-192.png', badge: '/icon-192.png',
          dir: 'rtl', lang: 'ar', tag: 'rest-done', vibrate: [180, 80, 180],
        }))
        .catch(() => {})
    }
  }, [done])

  const start = (t) => {
    const time = t !== undefined ? t : selected
    beepedRef.current = false
    setSelected(time)
    setPausedLeft(null)
    setEndsAt(Date.now() + time * 1000)
  }
  const pause  = () => setPausedLeft(secondsLeft(endsAt))
  const resume = () => { setEndsAt(Date.now() + pausedLeft * 1000); setPausedLeft(null) }
  const close  = () => { ls.remove(STORE); onClose() }

  const pct = selected > 0 ? Math.min(1, remaining / selected) : 0

  return (
    <div className="rt-bar" role="timer" aria-label="مؤقت الراحة" data-done={done ? '1' : undefined}>
      <div className="rt-row">
        <span className="rt-label">
          <Timer size={16} weight="bold" aria-hidden="true" />
          {done ? 'انتهت الراحة' : running ? 'راحة' : 'موقوفة'}
        </span>
        <Num className="rt-time">{restClock(remaining)}</Num>
        <div className="rt-actions">
          {running && <IconButton icon={Pause} label="إيقاف مؤقت" weight="bold" onClick={pause} />}
          {!running && !done && <IconButton icon={Play} label="استئناف" weight="bold" onClick={resume} />}
          {done && <Button variant="plain" size="md" onClick={close}>تمام</Button>}
          <IconButton icon={X} label="إغلاق المؤقت" weight="bold" onClick={close} />
        </div>
      </div>
      <Segmented
        className="rt-presets"
        label="مدة الراحة"
        value={done ? null : selected}
        onChange={start}
        options={REST_PRESETS.map(p => ({ value: p, label: <Num>{restClock(p)}</Num> }))}
      />
      <div className="rt-drain" aria-hidden="true"><i style={{ transform: `scaleX(${pct})` }} /></div>
    </div>
  )
}
