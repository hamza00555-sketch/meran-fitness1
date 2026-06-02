import { useState, useEffect, useRef } from 'react'
import { playBeep } from '../utils.js'
import { REST_PRESETS } from '../constants.js'

export default function RestTimer({ onClose }) {
  const [selected,  setSelected]  = useState(90)
  const [remaining, setRemaining] = useState(90)
  const [running,   setRunning]   = useState(true)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => setRemaining(r => r - 1), 1000)
    } else if (remaining === 0 && running) {
      setRunning(false)
      playBeep(4)
    }
    return () => clearInterval(intervalRef.current)
  }, [running, remaining])

  const start = (t) => {
    clearInterval(intervalRef.current)
    const time = t !== undefined ? t : selected
    setSelected(time)
    setRemaining(time)
    setRunning(true)
  }
  const pause  = () => { setRunning(false); clearInterval(intervalRef.current) }
  const resume = () => setRunning(true)

  const pct  = remaining / selected
  const R = 18, CX = 22, CY = 22
  const circ = 2 * Math.PI * R
  const dash  = circ * pct
  const done  = remaining === 0
  const mins  = Math.floor(remaining / 60)
  const secs  = remaining % 60

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
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
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
          {done ? '✓ انتهت الراحة!' : 'استراحة'}
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
            >⏸</button>
          )}
          {!running && remaining > 0 && (
            <button
              onClick={resume}
              style={{
                background: 'var(--cyan-lo)', border: '1px solid var(--cyan)',
                borderRadius: 8, width: 32, height: 32,
                color: 'var(--cyan)', cursor: 'pointer', fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >▶</button>
          )}
          {done && (
            <button
              onClick={onClose}
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
            onClick={onClose}
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
