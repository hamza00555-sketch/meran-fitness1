import { Num } from '../kit/index.jsx'
import { Check, Plus, Play } from '../kit/icons.js'
import { arabicName } from '../../exerciseMedia.js'

// ── The whole session at a glance ─────────────────────────────
// Every exercise, Arabic name first with the English under it, its
// done-count and its state, as open rows under the sets table. A tap
// brings that exercise on screen — nothing more. This (and a swipe on
// the exercise head) replaced the carousel, whose clipped neighbour
// card only ever showed «ck / تفت» at the edge.

export default function ExerciseQueue({ exercises, mapping = {}, activeIndex, onJump, onAdd }) {
  return (
    <section className="s-queue" aria-label="تمارين الجلسة">
      <h3 className="s-queue-h">تمارين الجلسة</h3>
      <div className="s-queue-list">
        {exercises.map((ex, i) => {
          const done = ex.sets.filter(s => s.done).length
          const complete = ex.sets.length > 0 && done === ex.sets.length
          const isActive = i === activeIndex
          const ar = arabicName(ex.name, mapping)
          return (
            <button
              key={ex.id}
              type="button"
              className="s-qrow"
              data-active={isActive ? '1' : undefined}
              data-complete={complete ? '1' : undefined}
              aria-current={isActive ? 'true' : undefined}
              onClick={() => onJump(i)}
            >
              <span className="s-qrow-mark" aria-hidden="true">
                {complete ? <Check size={18} weight="bold" />
                  : isActive ? <Play size={16} weight="fill" />
                  : <Num>{i + 1}</Num>}
              </span>
              <span className="s-qrow-names">
                <span className="s-qrow-ar">{ar || ex.name}</span>
                {ar && <span className="s-qrow-en" dir="ltr">{ex.name}</span>}
              </span>
              <Num className="s-qrow-count">{done}/{ex.sets.length}</Num>
            </button>
          )
        })}
        <button type="button" className="s-qrow s-qrow-add" onClick={onAdd}>
          <span className="s-qrow-mark" aria-hidden="true"><Plus size={18} weight="bold" /></span>
          <span className="s-qrow-names"><span className="s-qrow-ar">إضافة تمرين</span></span>
        </button>
      </div>
    </section>
  )
}
