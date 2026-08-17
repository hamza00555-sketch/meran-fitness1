// ── The layer that keeps the report breathing ─────────────────
// Three blurred orbs drifting behind everything, so the page has life
// even when nobody is scrolling. Three is a cap, not a coincidence:
// each is a large composited layer and a phone will only carry so many.
//
// Purely decorative, so it is hidden from assistive tech and never
// takes a pointer event.

const ORBS = [
  { color: 'var(--cyan)',   size: '58vw', top: '4%',  left: '-18%', dur: '34s', delay: '0s' },
  { color: 'var(--gold)',   size: '44vw', top: '46%', left: '62%',  dur: '41s', delay: '-8s' },
  { color: 'var(--purple)', size: '50vw', top: '78%', left: '-10%', dur: '37s', delay: '-19s' },
]

export default function Ambient() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0,
        overflow: 'hidden', pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {ORBS.map((o, i) => (
        <div
          key={i}
          className="mr-orb"
          style={{
            '--dur': o.dur,
            position: 'absolute',
            top: o.top, left: o.left,
            width: o.size, height: o.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${o.color} 0%, transparent 68%)`,
            opacity: 0.13,
            filter: 'blur(48px)',
            animationDelay: o.delay,
          }}
        />
      ))}
    </div>
  )
}
