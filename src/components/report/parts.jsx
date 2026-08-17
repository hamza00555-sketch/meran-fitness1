// ── Shared pieces of the report ───────────────────────────────
// Small building blocks the five sections all draw on, kept here so a
// number counts up the same way and a card lands the same way wherever
// it appears.

import { useEffect, useState } from 'react'
import { useCountUp } from '../../hooks/useMotion.js'

const AR = (n) => Number(n || 0).toLocaleString('en-US')

// ── A number that counts up and bumps when it lands ────────────
export function Counted({ value, run, decimals = 0, duration = 1100, style, suffix }) {
  const shown = useCountUp(value, { run, duration, decimals })
  const [landed, setLanded] = useState(false)

  useEffect(() => {
    if (!run) return
    const id = setTimeout(() => setLanded(true), duration)
    return () => clearTimeout(id)
  }, [run, duration])

  return (
    <span
      className={landed ? 'mr-tick' : undefined}
      style={{ display: 'inline-block', fontVariantNumeric: 'tabular-nums', ...style }}
    >
      {AR(shown)}{suffix}
    </span>
  )
}

// ── The one big number a section is built around ───────────────
// The halo behind it breathes continuously; that is most of what makes
// the section feel alive rather than merely arrived.
export function Hero({ value, run, unit, caption, color = 'var(--cyan)', size = 'clamp(44px, 13vw, 68px)' }) {
  return (
    <div style={{ position: 'relative', textAlign: 'center', padding: '18px 0 10px' }}>
      <div
        aria-hidden="true"
        className="mr-aura"
        style={{
          position: 'absolute', top: '46%', left: '50%',
          width: 220, height: 220, borderRadius: '50%',
          background: `radial-gradient(circle, ${color} 0%, transparent 66%)`,
          filter: 'blur(26px)', pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: size, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>
          <Counted value={value} run={run} />
        </div>
        {unit && (
          <div style={{ fontSize: 14, fontWeight: 700, color, marginTop: 6, fontFamily: 'var(--font-ar)' }}>
            {unit}
          </div>
        )}
        {caption && (
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, fontFamily: 'var(--font-ar)' }}>
            {caption}
          </div>
        )}
      </div>
    </div>
  )
}

// ── A small labelled figure ────────────────────────────────────
export function Tile({ value, label, run, color = 'var(--text)', i = 0, suffix }) {
  return (
    <div
      className={run ? 'mr-rise mr-shine' : undefined}
      style={{
        '--i': i,
        position: 'relative', overflow: 'hidden',
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '12px 10px', textAlign: 'center',
        opacity: run ? undefined : 0,
      }}
    >
      <div style={{ fontSize: 'clamp(18px, 5.4vw, 24px)', fontWeight: 900, color }}>
        <Counted value={value} run={run} suffix={suffix} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, fontFamily: 'var(--font-ar)' }}>
        {label}
      </div>
    </div>
  )
}

// ── A horizontal bar that grows in ─────────────────────────────
// Width is set inline and the growth comes from a scale transform, so
// the animation never touches layout.
export function Bar({ pct, color, run, i = 0, height = 10 }) {
  return (
    <div style={{
      background: 'var(--bg3)', borderRadius: 99,
      height, overflow: 'hidden', flex: 1,
    }}>
      <div
        className={run ? 'mr-bar-h' : undefined}
        style={{
          '--i': i,
          width: `${Math.max(2, Math.min(100, pct))}%`,
          height: '100%',
          borderRadius: 99,
          background: `linear-gradient(90deg, ${color}, ${color}AA)`,
          boxShadow: `0 0 8px ${color}66`,
          // The page is RTL, so a bar is anchored to the right of its
          // track. Growing from the left edge would make it slide in
          // from nowhere instead of extending out from its own start.
          transformOrigin: 'right',
          transform: run ? undefined : 'scaleX(0)',
        }}
      />
    </div>
  )
}

// ── A section heading ──────────────────────────────────────────
export function Heading({ children, note, run }) {
  return (
    <div
      className={run ? 'mr-rise' : undefined}
      style={{ '--i': 0, marginBottom: 14, opacity: run ? undefined : 0 }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: 'var(--font-ar)',
      }}>
        <span style={{
          width: 4, height: 20, borderRadius: 2,
          background: 'var(--cyan)', boxShadow: '0 0 8px var(--cyan)',
        }} />
        <h2 style={{ fontSize: 'clamp(17px, 4.6vw, 21px)', fontWeight: 900, color: 'var(--text)' }}>
          {children}
        </h2>
      </div>
      {note && (
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, fontFamily: 'var(--font-ar)' }}>
          {note}
        </div>
      )}
    </div>
  )
}

export { AR }
