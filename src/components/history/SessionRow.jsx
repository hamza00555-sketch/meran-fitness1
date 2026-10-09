import { IconButton, Button, Num } from '../kit/index.jsx'
import { DotsThree, CaretDown, ArrowCounterClockwise, Trophy } from '../kit/icons.js'
import { arabicName } from '../../exerciseMedia.js'
import Txt, { Count } from './Txt.jsx'
import { bestSet, doneExercises, durationText, isFirstBest, sessionSetCount } from './model.js'

// ── One session in the history: an open row, no box ───────────
// What you came to the history for is on the row itself: the day, the
// date, the two first lifts with their best set, and how long and how
// much. The full set list opens in place; edit and delete live behind
// one 44pt ⋯ instead of two 28pt emoji buttons 4pt apart (F29, F67).

/** «80 كجم × 12», «12 تكرار», or nothing. */
export function SetText({ weight, reps }) {
  if (weight > 0) {
    return <><Num>{+weight.toFixed(2)}</Num> <span className="hs-unit">كجم</span>{reps > 0 && <> × <Num>{reps}</Num></>}</>
  }
  return reps > 0 ? <><Num>{reps}</Num> <span className="hs-unit">تكرار</span></> : null
}

/** «أعلى وزن» in front of a record set; under 360pt the word gives its
 *  room to the exercise name and a gold trophy says it instead. */
function BestMark() {
  return (
    <>
      <span className="hs-pr hs-pr-word">أعلى وزن</span>
      <Trophy size={16} weight="fill" className="hs-pr hs-pr-icon" role="img" aria-label="أعلى وزن" />
    </>
  )
}

function ExerciseName({ name, mapping, withLatin }) {
  const ar = arabicName(name, mapping)
  return (
    <span className="hs-ex-name">
      {ar
        ? <span className="hs-ex-ar">{ar}</span>
        : <bdi dir="ltr" className="hs-ex-ar hs-ex-latin hs-latin">{name}</bdi>}
      {withLatin && ar && <bdi dir="ltr" className="hs-ex-en hs-latin">{name}</bdi>}
    </span>
  )
}

export default function SessionRow({ session, title, dateText, firsts, mapping = {}, expanded, onToggle, onMore }) {
  const exercises = doneExercises(session)
  const shown = expanded ? exercises : exercises.slice(0, 2)
  const more = exercises.length - shown.length
  const sets = sessionSetCount(session)
  const dur = durationText(session.duration)
  const detailsId = `hs-d-${session.id}`

  return (
    <article className="hs-row" aria-label={`${title} · ${dateText}`}>
      <button type="button" className="hs-row-main" onClick={onToggle}
        aria-expanded={!!expanded} aria-controls={detailsId}>
        <span className="hs-row-head">
          <span className="hs-row-title"><Txt>{title}</Txt></span>
          <span className="hs-row-date"><Txt>{dateText}</Txt></span>
        </span>

        <span className="hs-row-lines" id={detailsId}>
          {shown.map((ex, i) => {
            const best = bestSet(ex)
            const gold = best && best.weight > 0 && isFirstBest(firsts, session, ex, mapping)
            return (
              <span key={ex.id || i} className={expanded ? 'hs-ex hs-ex-open' : 'hs-ex'}>
                <span className="hs-ex-line">
                  <ExerciseName name={ex.name} mapping={mapping} withLatin={expanded} />
                  {best && (
                    <span className={gold ? 'hs-best hs-gold' : 'hs-best'}>
                      {gold && <BestMark />}
                      <SetText {...best} />
                    </span>
                  )}
                </span>
                {expanded && (
                  <span className="hs-sets" aria-label="المجموعات">
                    {(ex.sets || []).filter(s => s.done).map((s, si) => {
                      const w = parseFloat(s.weight) || 0, r = parseInt(s.reps) || 0
                      return (
                        <span key={si} className="hs-set">
                          <span className="hs-set-n"><Num>{si + 1}</Num></span>
                          <span className="hs-set-v">{w > 0 ? <><Num>{+w.toFixed(2)}</Num> × <Num>{r || '—'}</Num></> : <><Num>{r || '—'}</Num> تكرار</>}</span>
                        </span>
                      )
                    })}
                  </span>
                )}
              </span>
            )
          })}
        </span>

        <span className="hs-row-meta">
          <span>
            {dur && <><Txt>{dur}</Txt> · </>}
            <Count n={sets} noun="set" />
          </span>
          <span className="hs-toggle">
            {more > 0 && <span>+<Count n={more} noun="exercise" /></span>}
            <CaretDown size={16} weight="bold" className="hs-caret" aria-hidden="true" />
          </span>
        </span>
      </button>
      <IconButton icon={DotsThree} weight="bold" label={`خيارات جلسة ${dateText}`} onClick={onMore} className="hs-more-btn" />
    </article>
  )
}

/** In the deleted row's place for six seconds: say what went, offer it back. */
export function UndoRow({ label, onUndo, ms = 6000 }) {
  return (
    <div className="hs-undo" role="status">
      <span className="hs-undo-text">انحذفت جلسة <Txt>{label}</Txt></span>
      <Button variant="plain" size="md" icon={ArrowCounterClockwise} onClick={onUndo}>تراجع</Button>
      <i className="hs-undo-clock" style={{ animationDuration: `${ms}ms` }} aria-hidden="true" />
    </div>
  )
}
