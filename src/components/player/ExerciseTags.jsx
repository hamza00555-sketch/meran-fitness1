import { Num } from '../kit/index.jsx'
import { ArrowsLeftRight, Drop } from '../kit/icons.js'
import { equipLabel, arabicName } from '../../exerciseMedia.js'
import { MUSCLE_GROUPS } from '../../constants.js'
import { kg } from './sessionWords.js'

// ── What the exercise says about itself, in one quiet line ────
//
// The tag row used to be seven chips: a muscle badge in the muscle's
// colour with an emoji, the equipment, a coaching chip with a boxed
// emoji, a red YouTube logo, and last/best weights. In session mode it
// is one 13px line under the name strap: muscle · equipment · best
// weight. Colour is state, so the muscle loses its hue; the best weight
// keeps gold, because best weight is gold's job — except while the
// screen is already saying "raise", when gold belongs to the number.
// The coaching moved into the coach line under the counters; YouTube
// moved into the ⋯ sheet.

export default function ExerciseTags({ ex, mapping = {}, maxWeight = null, deloadPct = 0, quietBest = false }) {
  const group = MUSCLE_GROUPS[ex.muscle]
  const equip = equipLabel(ex.name, mapping)
  const origin = ex.originalName && ex.originalName !== ex.name ? ex.originalName : null
  const originAr = origin ? arabicName(origin, mapping) : null
  const parts = [group?.label || null, equip].filter(Boolean)
  return (
    <div className="s-meta">
      {parts.map((p, i) => (
        <span key={i} className="s-meta-part">{p}</span>
      ))}
      {maxWeight != null && (
        <span className="s-meta-part" data-best={quietBest ? undefined : '1'}>
          أعلى وزن <Num>{kg(maxWeight)}</Num> كجم
        </span>
      )}
      {deloadPct > 0 && (
        <span className="s-meta-part s-meta-deload">
          <Drop size={14} weight="fill" aria-hidden="true" /> ديلود <Num>−{deloadPct}%</Num>
        </span>
      )}
      {origin && (
        <span className="s-meta-part">
          <ArrowsLeftRight size={14} weight="bold" aria-hidden="true" /> بدل {originAr || <bdi dir="ltr" className="s-latin">{origin}</bdi>}
          {originAr && <><span className="s-latin-sep" aria-hidden="true">—</span><bdi dir="ltr" className="s-latin">{origin}</bdi></>}
        </span>
      )}
    </div>
  )
}
