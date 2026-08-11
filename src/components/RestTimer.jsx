import { useState, useEffect, useRef } from 'react'
import Ico from '../assets/Ico.jsx'
import { playBeep, ls } from '../utils.js'
import { REST_PRESETS } from '../constants.js'

const STORE = 'hf_rest_timer'

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
    playBeep(4)
    if (document.hidden) {
      navigator.serviceWorker?.ready
        .then(reg => reg.showNotification('انتهت الراحة', {
          body: 'ارجع للتمرين — السيت التالي جاهز.',
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

  const pct  = selected > 0 ? remaining / selected : 0
  const R = 18, CX = 22, CY = 22
  const circ = 2 * Math.PI * R
  const dash = circ * pct
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60

  return (
    <div style={{
      position: 'fixed',
      top: 'calc(var(--safe-top, 0px) + 74px)',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 28px)',
      maxWidth: 532,
      zIndex: 150,
      background: 'rgba(7,8,12,0.97)',
      border: `1px solid ${done ? '#22C55E' : 'var(--cyan)'}`,
      borderRadius: 16,
      backdropFilter: 'blur(20px)',
      padding: '10px 14px',
      boxShadow: `0 4px 20px ${done ? 'rgba(34,197,94,0.18)' : 'rgba(0,210,255,0.14)'}`,
      transition: 'border-color 0.3s, box-shadow 0.3s',
    }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Mini ring */}
        <svg width={44} height={44} viewBox="0 0 44 44" style={{ flexShrink: 0 }}>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border2)" strokeWidth={4} />
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={done ? '#22C55E' : 'var(--cyan)'}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ - dash}
            transform={`rotate(-90 ${CX} ${CY})`}
            style={{ transition: 'stroke-dashoffset 0.25s linear, stroke 0.3s' }}
          />
        </svg>

        {/* Time */}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 800,
          color: done ? '#22C55E' : 'var(--text)',
          minWidth: 70, letterSpacing: 1,
        }}>
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </div>

        {/* Label */}
        <div style={{ flex: 1, fontFamily: 'var(--font-ar)', fontSize: 12, color: done ? '#22C55E' : 'var(--text3)' }}>
          {done ? '✓ انتهت الراحة!' : running ? 'استراحة' : 'موقوف'}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {running && (
            <button
              onClick={pause}
              style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 8, width: 32, height: 32,
                color: 'var(--text2)', cursor: 'pointer', fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            ><Ico id="pause" size={16} /></button>
          )}
          {!running && !done && (
            <button
              onClick={resume}
              style={{
                background: 'var(--cyan-lo)', border: '1px solid var(--cyan)',
                borderRadius: 8, width: 32, height: 32,
                color: 'var(--cyan)', cursor: 'pointer', fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            ><Ico id="play" size={16} /></button>
          )}
          {done && (
            <button
              onClick={close}
              style={{
                background: 'rgba(34,197,94,0.12)', border: '1px solid #22C55E50',
                borderRadius: 8, padding: '0 12px', height: 32,
                color: '#22C55E', cursor: 'pointer', fontSize: 12,
                fontFamily: 'var(--font-ar)', fontWeight: 700,
                display: 'flex', alignItems: 'center',
              }}
            >تمام ✓</button>
          )}
          <button
            onClick={close}
            style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 8, width: 32, height: 32,
              color: 'var(--text3)', cursor: 'pointer', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1,
            }}
          >×</button>
        </div>
      </div>

      {/* Preset row */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {REST_PRESETS.map(p => (
          <button
            key={p}
            onClick={() => start(p)}
            style={{
              flex: 1,
              background: selected === p && !done ? 'var(--cyan-lo)' : 'var(--bg2)',
              border: `1px solid ${selected === p && !done ? 'var(--cyan)' : 'var(--border)'}`,
              borderRadius: 8, padding: '5px 0',
              color: selected === p && !done ? 'var(--cyan)' : 'var(--text3)',
              fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >{p < 60 ? `${p}s` : `${p / 60}m`}</button>
        ))}
      </div>
    </div>
  )
}
