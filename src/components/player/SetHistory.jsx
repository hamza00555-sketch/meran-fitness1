import { Num } from '../kit/index.jsx'
import { Trophy } from '../kit/icons.js'
import SetPhrase from './SetPhrase.jsx'
import { kg, setWords, repsWord } from './sessionWords.js'

// ── The sets, one row each ────────────────────────────────────
//
// No column header. A header row labelled the columns of a table whose
// first row is usually the live block — so it sat over a card and named
// nothing under it — and «السابق» was gym-app jargon. Instead every row
// says what it is, in the one format the player prints a set in:
//
//   2   75 كجم × 12 عدّة                    ○
//       آخر مرة 72.5 كجم × 9 عدّات
//
// The set's numbers on the first line, and under them, small and quiet,
// what this set was last time — the coach line's own words, units and
// all. Always two lines when there is a last time, at every width, so
// the list keeps one rhythm instead of wrapping row by row on a narrow
// phone. A row with no history says nothing there rather than «—». The
// weight column has a fixed width, so the reps still line up down the
// list the way a table's would.
//
// The row being worked is not a row at all: it opens into the live
// block (passed in as `live`), so the numbers you are about to lift sit
// where the set sits.
//
// Done rows are tinted with the brand green and carry a check that
// draws itself once (~180ms) the moment the set is ticked — that is the
// whole acknowledgement: no flying XP, no toast. Tapping a done row
// hands it to the live block in its labelled editing mode; the row
// itself never becomes an input, so a stray thumb can't change history.
// Rows still to come show their planned numbers, quietly.
//
// A set heavier than anything on record wears gold — the one place a
// personal best is said, on the row that set it: the weight in gold, and
// a gold trophy where its check would be.

function Tick({ on, fresh, pr }) {
  if (on && pr) {
    return <Trophy size={20} weight="fill" className="s-pr-icon" role="img" aria-label="رقم قياسي" />
  }
  return (
    <span className="s-tick" data-on={on ? '1' : undefined} data-fresh={fresh ? '1' : undefined} aria-hidden="true">
      {on && (
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path d="M5.5 12.5l4.2 4.2L18.5 7.5" fill="none" stroke="currentColor"
            strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" pathLength="24" />
        </svg>
      )}
    </span>
  )
}

const dash = <span className="s-dash">—</span>

export default function SetHistory({
  ex, liveIndex, currentIndex, editingIndex, prevSets = [], freshIndex = null, prIndex = null,
  onEdit, live,
}) {
  const hasHistory = ex.sets.some((_, i) => i !== liveIndex && setWords(prevSets[i]))
  return (
    <div className="s-table" role="list" aria-label="المجموعات" data-history={hasHistory ? '1' : undefined}>
      {ex.sets.map((s, i) => {
        if (i === liveIndex && live) return <div key={i} role="listitem" className="s-trow-live">{live}</div>
        const prev = setWords(prevSets[i])
        const isPR = i === prIndex
        const w = kg(s.weight)
        const r = parseInt(s.reps)
        const state = s.done ? 'done' : i === currentIndex ? 'current' : 'next'
        const body = (
          <>
            <span className="s-cell-n"><span className="s-sr">المجموعة </span><Num>{i + 1}</Num></span>
            {/* A missing half is left out, the way setWords says it aloud:
                a bodyweight set reads «10 عدّات», not «— كجم × 10 عدّات».
                The cells stay, so the columns still line up. */}
            <span className="s-cell-kg" data-pr={isPR ? '1' : undefined}>
              {w ? <><Num>{w}</Num><span className="s-unit">كجم</span></> : !(r > 0) && dash}
            </span>
            <span className="s-cell-x" aria-hidden="true">{w && r > 0 ? '×' : null}</span>
            <span className="s-cell-reps">
              {r > 0 && <><Num>{r}</Num><span className="s-unit">{repsWord(r)}</span></>}
            </span>
            {prev && (
              <span className="s-cell-prev">
                <span className="s-prev-label">آخر مرة</span> <SetPhrase set={prevSets[i]} />
              </span>
            )}
            <span className="s-cell-tick"><Tick on={s.done} fresh={i === freshIndex} pr={isPR} /></span>
          </>
        )
        return (
          <div key={i} role="listitem">
            {s.done ? (
              <button type="button" className="s-trow" data-state={state} data-prev={prev ? '1' : undefined}
                data-editing={i === editingIndex ? '1' : undefined}
                aria-label={`المجموعة ${i + 1}: ${setWords(s) || 'فاضية'}${isPR ? ' — رقم قياسي' : ''}${prev ? ` — آخر مرة ${prev}` : ''} — اضغط للتعديل`}
                onClick={() => onEdit(i)}>
                {body}
              </button>
            ) : (
              <div className="s-trow" data-state={state} data-prev={prev ? '1' : undefined}>{body}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
