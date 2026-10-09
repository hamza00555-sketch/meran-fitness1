// ── A trend line, drawn to scale ──────────────────────────────
//
// Replaces six identical «80kg» chips (critique F37) with the shape of
// the last sessions. Time runs the way Arabic reads: the oldest session
// on the right, the newest on the left, where the dot sits — the same
// direction every progress bar in the app fills.
//
// To scale, honestly: the vertical range is never narrower than 10% of
// the value, so a 2.5 kg step on an 80 kg lift is a gentle rise, not a
// cliff. A flat history is a flat line through the middle.
//
// The stroke does not scale with the box (vector-effect), so a wide
// sparkline in the sheet keeps the same 2px line as the 64px one in a
// row; the end dot is a zero-length round-capped stroke for the same
// reason.

export default function Sparkline({ values = [], width = 64, height = 24, fluid = false, label, className }) {
  const pts = values.filter(v => Number.isFinite(v) && v > 0)
  const W = fluid ? 300 : width
  const H = height
  const pad = 3
  const cls = ['lib-spark', className].filter(Boolean).join(' ')
  const size = fluid ? { width: '100%', height } : { width, height }

  if (!pts.length) return null

  const lo = Math.min(...pts)
  const hi = Math.max(...pts)
  const minSpan = Math.max(hi * 0.1, 1)
  let a = lo, b = hi
  if (b - a < minSpan) { const mid = (a + b) / 2; a = mid - minSpan / 2; b = mid + minSpan / 2 }
  const y = v => pad + (b - v) / (b - a) * (H - pad * 2)
  // Oldest on the right (x = W - pad), newest on the left (x = pad).
  const x = i => pts.length === 1 ? W / 2 : W - pad - i * (W - pad * 2) / (pts.length - 1)
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const lx = x(pts.length - 1), ly = y(pts[pts.length - 1])

  return (
    <svg className={cls} style={size} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      role="img" aria-label={label} focusable="false">
      {pts.length > 1 && (
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      )}
      <path d={`M${lx.toFixed(1)} ${ly.toFixed(1)}h0`} stroke="currentColor" strokeWidth="6"
        strokeLinecap="round" vectorEffect="non-scaling-stroke" className="lib-spark-dot" />
    </svg>
  )
}
