// ── The day's muscles, lit on the body ───────────────────────
//
// The builder's small green body figure (src/pages/planner/body.js — the
// react-native-body-highlighter paths, front and back), drawn in React for
// «خطتي»'s day header. It comes with the plan view's own lazy chunk, so it
// loads only when the view opens. A muscle the day works directly lights
// fully, one it works half (a press for the triceps) lights faintly — the
// builder's own count (catalogue credits), the back as one muscle.
//
// Neutral, not green (the one green on a screen is its primary action,
// and nothing on «خطتي» is): dark plates on dark seams, the body's
// silhouette a grey contour set a hair outside it, the day's muscles in
// white, the half-worked ones in a mid grey. A lit muscle touches only
// the seams, the plates and the other lit state — never the contour (the
// gap between them is the seams' colour) — and each lit state is 3:1 or
// more against every one of those (planview.css, .pv-b-*; measured on
// the pixels by tests/plan-view.e2e.mjs). Three layers under the
// muscles: the contour (a wide grey stroke of the outline), the seams
// (the outline filled, and stroked a little narrower in the same colour,
// so 1px of the contour shows, apart from the body), the plates.

import { memo, useMemo } from 'react'
import { BODY, REGKEY } from '../planner/body.js'
import { creditsOf } from '../../monthReport.js'

// The regions, read once: [side, key or null, hair, d].
const REGIONS = []
for (const side of ['front', 'back']) {
  const sd = BODY[side]
  if (!sd) continue
  for (const slug of Object.keys(sd)) {
    if (slug === 'outline') continue
    for (const half of ['left', 'right', 'common']) {
      for (const d of sd[slug][half] || []) REGIONS.push({ side, key: REGKEY[side][slug] || null, hair: slug === 'hair', d })
    }
  }
}

/** { area: 'ok' | 'some' } for the exercises of a day, as the builder lights them. */
export function dayAreas(exercises = []) {
  const out = {}
  for (const ex of exercises) {
    for (const [a, c] of Object.entries(creditsOf(ex) || {})) {
      const k = a === 'lats' || a === 'rows' ? 'back' : a
      if (out[k] !== 'ok') out[k] = c >= 1 ? 'ok' : 'some'
    }
  }
  return out
}

function BodyFigure({ exercises = [], className = '' }) {
  const lit = useMemo(() => dayAreas(exercises), [exercises])
  return (
    <svg className={`pv-body ${className}`} viewBox="0 86 1448 1284" preserveAspectRatio="xMidYMid meet"
      aria-hidden="true" focusable="false">
      {['front', 'back'].map(side => (
        <g key={side} transform={`translate(${side === 'front' ? 724 : -724} 0)`}>
          <path d={BODY[side].outline} className="pv-b-rim" vectorEffect="non-scaling-stroke" />
          <path d={BODY[side].outline} className="pv-b-out" vectorEffect="non-scaling-stroke" />
          {REGIONS.filter(r => r.side === side).map((r, i) => (
            <path key={i} d={r.d} className={r.hair ? 'pv-b-hair' : 'pv-b-base'} />
          ))}
          {REGIONS.filter(r => r.side === side && r.key && lit[r.key]).map((r, i) => (
            <path key={`l${i}`} d={r.d} className="pv-b-lit" data-s={lit[r.key]} />
          ))}
        </g>
      ))}
    </svg>
  )
}

export default memo(BodyFigure)
