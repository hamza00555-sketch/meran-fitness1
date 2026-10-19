// ── «بالتناوب» in the session ─────────────────────────────────
//
// حمزة: «اليوم رجول بسوي هيب ابدكشن اجي يوم ثاني للرجول يعمل هيب اددكشن.
// والميزة تسمح لي بالاختيار». A row of his plan that takes turns starts on
// the one due (App.startPlannedWorkout, src/plan/rotate.js). Under the
// exercise's head, one quiet line on the page (not a card) says so and
// which comes the next time; before his first set, one tap does the other
// one this time instead («بدّلها لـ … هالمرة» — WorkoutPage.handleRotate).
// Whatever he does is what counts: the next time follows from it.

import { Repeat, ArrowsLeftRight } from '../kit/icons.js'
import { arabicName } from '../../exerciseMedia.js'
import { nextMember } from '../../plan/rotate.js'

/** The Arabic name, or the English one alone in its own direction. */
function Name({ name, mapping }) {
  const ar = arabicName(name, mapping)
  return ar ? <>{ar}</> : <bdi dir="ltr" className="s-latin">{name}</bdi>
}

export default function RotateBar({ ex, mapping = {}, canSwitch = false, onSwitch }) {
  const members = Array.isArray(ex?.rotate) && ex.rotate.length > 1 ? ex.rotate : null
  if (!members) return null
  const next = nextMember(members, ex, { mapping })
  if (!next) return null
  return (
    <div className="s-rot" data-testid="rotate-bar">
      <p className="s-rot-line">
        <Repeat size={16} weight="bold" aria-hidden="true" />
        <span><b>بالتناوب</b> · المرة الجاية: <span data-testid="rotate-next"><Name name={next} mapping={mapping} /></span></span>
      </p>
      {canSwitch && (
        <button type="button" className="s-rot-switch" data-testid="rotate-switch" data-name={next} onClick={() => onSwitch?.(next)}>
          <ArrowsLeftRight size={16} weight="bold" aria-hidden="true" />
          <span>بدّلها لـ{' '}<Name name={next} mapping={mapping} /> هالمرة</span>
        </button>
      )}
    </div>
  )
}
