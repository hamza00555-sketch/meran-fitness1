import { Num } from '../kit/index.jsx'
import { Trophy } from '../kit/icons.js'
import { kg, setLabel } from './sessionWords.js'

// ── The sets table ────────────────────────────────────────────
//
// المجموعة · السابق · كجم · عدّات — one row per set, open on the
// ground, the way Strong and Hevy lay a session out. The row being
// worked is not a row at all: it opens into the live block (passed in
// as `live`), so the numbers you are about to lift sit where the set
// sits.
//
// Done rows are tinted with the brand green and carry a check that
// draws itself once (~180ms) the moment the set is ticked — that is the
// whole acknowledgement: no flying XP, no toast. Tapping a done row
// hands it to the live block in its labelled editing mode; the row
// itself never becomes an input, so a stray thumb can't change history.
// Rows still to come show their planned numbers, quietly.
//
// A set heavier than anything on record wears gold — the one place a
// personal best is said, on the row that set it.

function Tick({ on, fresh }) {
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

export default function SetHistory({
  ex, liveIndex, currentIndex, editingIndex, prevSets = [], freshIndex = null, prIndex = null,
  onEdit, live,
}) {
  return (
    <div className="s-table" role="table" aria-label="المجموعات">
      <div className="s-thead" role="row">
        <span role="columnheader">المجموعة</span>
        <span role="columnheader">السابق</span>
        <span role="columnheader">كجم</span>
        <span role="columnheader">عدّات</span>
        <span role="columnheader" className="s-sr">الحالة</span>
      </div>
      {ex.sets.map((s, i) => {
        if (i === liveIndex && live) return <div key={i} role="row" className="s-trow-live">{live}</div>
        const prev = setLabel(prevSets[i])
        const isPR = i === prIndex
        const state = s.done ? 'done' : i === currentIndex ? 'current' : 'next'
        const body = (
          <>
            <span className="s-cell-n" role="cell"><Num>{i + 1}</Num></span>
            <span className="s-cell-prev" role="cell">{prev ? <Num>{prev}</Num> : <span className="s-dash">—</span>}</span>
            <span className="s-cell-kg" role="cell" data-pr={isPR ? '1' : undefined}>
              {kg(s.weight) ? <Num>{kg(s.weight)}</Num> : <span className="s-dash">—</span>}
              {isPR && <Trophy size={16} weight="fill" className="s-pr-icon" aria-label="رقم قياسي" />}
            </span>
            <span className="s-cell-reps" role="cell">
              {parseInt(s.reps) > 0 ? <Num>{parseInt(s.reps)}</Num> : <span className="s-dash">—</span>}
            </span>
            <span className="s-cell-tick" role="cell"><Tick on={s.done} fresh={i === freshIndex} /></span>
          </>
        )
        return s.done ? (
          <button key={i} type="button" role="row" className="s-trow" data-state={state}
            data-editing={i === editingIndex ? '1' : undefined}
            aria-label={`المجموعة ${i + 1}: ${kg(s.weight) || 0} كجم × ${parseInt(s.reps) || 0} — اضغط للتعديل`}
            onClick={() => onEdit(i)}>
            {body}
          </button>
        ) : (
          <div key={i} role="row" className="s-trow" data-state={state}>{body}</div>
        )
      })}
    </div>
  )
}
