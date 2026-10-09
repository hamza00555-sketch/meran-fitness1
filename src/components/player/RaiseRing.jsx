import { useEffect, useState } from 'react'

// ── «Add weight», drawn on the number itself ──────────────────
//
// The ring used to circle the whole exercise card — the name and a
// still picture — while the suggested weight underneath still said the
// old number. Now it goes around the one thing the advice is about: the
// weight field, which already shows the raised number in gold.
//
// Drawn ONCE, then still. Two strokes start at the bottom centre and
// climb both sides to meet at the top (two lines rising reads as "up";
// one line circling reads as "loading"), and the ring stays. `draw`
// false renders it already whole — the second set of the same exercise,
// or reduced motion — so the motion happens once per exercise.
//
// Real pixels are needed for the corner arcs, so the host is measured,
// and its radius read from computed style rather than typed here.

const INSET = 1          // half the stroke, so the line sits fully inside

/** One half of the ring: bottom centre up to top centre, on one side. */
function half(w, h, r, dir) {
  const cx = w / 2
  const x  = cx + dir * (w / 2 - INSET)
  const y0 = h - INSET, y1 = INSET
  const rr = Math.max(0, Math.min(r - INSET, (w / 2 - INSET), (h / 2 - INSET)))
  const sweep = dir > 0 ? 0 : 1
  return [
    `M ${cx} ${y0}`,
    `L ${x - dir * rr} ${y0}`,
    `A ${rr} ${rr} 0 0 ${sweep} ${x} ${y0 - rr}`,
    `L ${x} ${y1 + rr}`,
    `A ${rr} ${rr} 0 0 ${sweep} ${x - dir * rr} ${y1}`,
    `L ${cx} ${y1}`,
  ].join(' ')
}

export default function RaiseRing({ hostRef, draw = true }) {
  const [box, setBox] = useState(null)

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const measure = () => {
      const cs = getComputedStyle(el)
      const bw = parseFloat(cs.borderLeftWidth) || 0
      const r = Math.max(0, (parseFloat(cs.borderTopLeftRadius) || 0) - bw)
      setBox({ w: el.clientWidth, h: el.clientHeight, r })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [hostRef])

  if (!box || box.w < 40 || box.h < 30) return null
  const { w, h, r } = box

  return (
    <svg
      className={`raise-ring s-raise-ring${draw ? ' s-raise-draw' : ''}`}
      data-testid="raise-ring"
      aria-hidden="true"
      width={w} height={h} viewBox={`0 0 ${w} ${h}`}
    >
      {[1, -1].map(dir => (
        <path
          key={dir}
          className="s-raise-path"
          d={half(w, h, r, dir)}
          pathLength="100"
          fill="none"
          stroke="var(--raise)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}
