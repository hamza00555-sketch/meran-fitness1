import { useState, useEffect, useRef } from 'react'
import { Card, Btn, CloseBtn } from './ui.jsx'
import { playBeep } from '../utils.js'
import { REST_PRESETS } from '../constants.js'
import { Overlay } from './ui.jsx'

export default function RestTimer({ onClose }) {
  const [selected, setSelected] = useState(90)
  const [remaining, setRemaining] = useState(null)
  const [running, setRunning] = useState(false)
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
    setSelected(t ?? selected)
    setRemaining(t ?? selected)
    setRunning(true)
  }
  const pause = () => { setRunning(false); clearInterval(intervalRef.current) }
  const resume = () => setRunning(true)
  const reset = () => { pause(); setRemaining(null) }

  const pct = remaining !== null ? remaining / selected : 1
  const R = 54, CX = 70, CY = 70
  const circ = 2 * Math.PI * R
  const dash = circ * pct
  const done = remaining === 0
  const mins = remaining !== null ? Math.floor(remaining / 60) : Math.floor(selected / 60)
  const secs = remaining !== null ? remaining % 60 : selected % 60

  return (
    <Overlay onClose={onClose} align="center">
      <Card style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 17, fontWeight: 800 }}>⏱️ Rest Timer</div>
            <div style={{ fontSize: 10, color: 'var(--text4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              وقفة راحة بين السيتات
            </div>
          </div>
          <CloseBtn onClick={onClose} />
        </div>

        {/* SVG ring */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
          <svg width={140} height={140} viewBox="0 0 140 140">
            {/* Track */}
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border2)" strokeWidth={10} />
            {/* Progress */}
            <circle
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={done ? 'var(--green)' : 'var(--orange)'}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ - dash}
              transform={`rotate(-90 ${CX} ${CY})`}
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
            />
            {/* Time text */}
            <text
              x={CX} y={CY + 8}
              textAnchor="middle"
              fill={done ? '#22C55E' : 'var(--text)'}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700 }}
            >
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </text>
            {done && (
              <text x={CX} y={CY + 26} textAnchor="middle" fill="#22C55E"
                style={{ fontSize: 11, fontFamily: 'var(--font-ar)', fontWeight: 700 }}>
                خلصت! 🎉
              </text>
            )}
          </svg>
        </div>

        {/* Preset buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
          {REST_PRESETS.map(p => (
            <button
              key={p}
              onClick={() => start(p)}
              style={{
                background: selected === p && !done ? 'var(--orange-lo)' : 'var(--bg3)',
                border: `1px solid ${selected === p && !done ? 'var(--orange)' : 'var(--border)'}`,
                borderRadius: 8, padding: '7px 10px',
                color: selected === p && !done ? 'var(--orange)' : 'var(--text3)',
                fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >{p < 60 ? `${p}s` : `${p / 60}m`}</button>
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {remaining === null && (
            <Btn onClick={() => start()} full>▶ ابدأ</Btn>
          )}
          {running && (
            <Btn onClick={pause} variant="danger">⏸ إيقاف</Btn>
          )}
          {!running && remaining !== null && remaining > 0 && (
            <Btn onClick={resume}>▶ استمر</Btn>
          )}
          {remaining !== null && (
            <Btn onClick={reset} variant="ghost">↺ إعادة</Btn>
          )}
          {done && (
            <Btn onClick={onClose} variant="success">✓ تمام</Btn>
          )}
        </div>
      </Card>
    </Overlay>
  )
}
