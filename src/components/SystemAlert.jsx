import { useEffect, useRef } from 'react'

const DURATION = 3200 // ms before auto-dismiss

export default function SystemAlert({ alerts: queue, onRemove }) {
  const current  = queue[0]
  const timerRef = useRef(null)

  // Reset 3s timer whenever the current card changes OR same type bumps
  useEffect(() => {
    if (!current) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(onRemove, DURATION)
    return () => clearTimeout(timerRef.current)
  }, [current?.id, current?.bumpAt, onRemove])

  if (!current) return null

  const hasPending = queue.length > 1

  return (
    <div style={{
      position: 'fixed',
      top: 'calc(var(--safe-top) + 8px)',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%', maxWidth: 560,
      zIndex: 900,
      padding: '0 12px',
      pointerEvents: 'none',
    }}>
      <div
        key={current.id}
        className="slide-down"
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          borderRadius: 14,
          padding: '11px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 28px rgba(0,0,0,0.45)',
          pointerEvents: 'all',
          position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Thin progress bar draining from right to left */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
          background: 'var(--border)',
          borderRadius: '0 0 14px 14px',
        }}>
          <div style={{
            height: '100%',
            background: 'var(--cyan)',
            borderRadius: '0 0 14px 14px',
            animation: `alertDrain ${DURATION}ms linear forwards`,
          }} />
        </div>

        {/* Icon */}
        <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{current.icon}</span>

        {/* Message */}
        <span
          key={current.bumpAt}
          style={{
            fontFamily: 'var(--font-ar)', fontSize: 14,
            color: 'var(--text)', flex: 1,
            animation: current.count > 1 ? 'alertBump 0.25s ease' : 'none',
          }}
        >{current.msg}</span>

        {/* Count badge — only when same type fires multiple times */}
        {current.count > 1 && (
          <span
            key={`c-${current.bumpAt}`}
            style={{
              background: 'var(--cyan-lo)', border: '1px solid var(--cyan-md)',
              borderRadius: 20, padding: '1px 8px',
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--cyan)', fontWeight: 700, flexShrink: 0,
              animation: 'alertBump 0.25s ease',
            }}
          >×{current.count}</span>
        )}

        {/* Pending queue dot */}
        {hasPending && (
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--text3)', flexShrink: 0,
            opacity: 0.5,
          }} title={`${queue.length - 1} إشعار في الانتظار`} />
        )}

        {/* Dismiss button */}
        <button
          onClick={onRemove}
          style={{
            background: 'none', border: 'none',
            color: 'var(--text3)', fontSize: 18,
            cursor: 'pointer', lineHeight: 1, padding: '0 2px',
            flexShrink: 0,
          }}
        >×</button>
      </div>
    </div>
  )
}
