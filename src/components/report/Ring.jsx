// ── A ring that draws itself ──────────────────────────────────
// The same two-circle recipe the achievements page already uses, with
// the arc animated in by its dash offset rather than appearing whole.
//
//   <Ring value={13} max={31} run={revealed} label="١٣" sub="يوم" />
//
// Nothing here animates until `run` is true, so a ring below the fold
// still has its entrance waiting when it is scrolled to.

export default function Ring({
  value = 0, max = 1, run = false,
  size = 132, stroke = 10,
  color = 'var(--cyan)', track = 'var(--border)',
  label, sub, delay = 0,
}) {
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const offset = circumference * (1 - pct)

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={track} strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          className={run ? 'mr-draw' : undefined}
          style={{
            '--dash': circumference,
            '--offset': offset,
            strokeDasharray: circumference,
            // Before it runs the arc is fully retracted, so the reveal
            // has somewhere to travel from.
            strokeDashoffset: run ? undefined : circumference,
            animationDelay: `${delay}ms`,
            filter: `drop-shadow(0 0 6px ${color})`,
          }}
        />
      </svg>

      {(label !== undefined || sub) && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-ar)', lineHeight: 1.1,
        }}>
          <div style={{
            fontSize: size * 0.27, fontWeight: 900, color: 'var(--text)',
            fontVariantNumeric: 'tabular-nums',
          }}>{label}</div>
          {sub && <div style={{ fontSize: size * 0.1, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
        </div>
      )}
    </div>
  )
}
