import { useEffect, useMemo, useState } from 'react'
import { Sheet, Num, IconButton } from '../kit/index.jsx'
import { explainerView, dayLine, unitAr } from '../../streak.js'
import { restDaysView, restDaysCopy } from '../../restDays.js'
import { Flame, Moon, Ticket, Cross } from './StreakIcons.jsx'
import { Check, Hourglass, CaretRight, CaretLeft, CaretDown } from '../kit/icons.js'
import useMinute from './useMinute.js'
import '../../styles/streak-sheet.css'

// ── «ليش 60؟» ─────────────────────────────────────────────────
// Tapping the streak anywhere opens this: the number as a sum, today,
// the optional rest days, and the days on a calendar — all read from the
// ledger that produced the number (streak.js explainerView).
//
// حمزة: «ابا نقلل النص بحيث يكون ما قل ودل». Each fact once, in a short
// line; no rules, no engine. At the top, under the number: whether today
// is counted or still needed (Home's flame used to say it), and
// «أيام الراحة الاختيارية: N» with the day each was earned and the last
// ones used. The flame here means what it means on Home: filled while he
// holds one. «ليش مو 58؟» opens one line, only when optional rest days
// sit between the calendar days and the number.

const WEEK = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'] // Sunday first

function Glyph({ kind }) {
  switch (kind) {
    case 'trained': case 'today-done': return <i className="ss-dot" />
    case 'rest': case 'today-rest': return <span className="ss-rest"><Moon size={14} /></span>
    case 'credit': return <span className="ss-rest"><Ticket size={14} /></span>
    case 'missed': return <span className="ss-miss"><Cross size={12} /></span>
    case 'idle': return <span className="ss-idle"><Cross size={9} /></span>
    default: return null
  }
}

export default function StreakSheet({ open, onClose, recovery, config, active, deload, today, storedBest }) {
  // The countdown moves while the sheet is open; closed, nothing ticks.
  const tick = useMinute()
  const now = open ? tick : undefined
  const e = useMemo(
    () => explainerView({ recovery, config, active, deload, now, today, storedBest }),
    [recovery, config, active, deload, now, today, storedBest],
  )
  const rd = useMemo(() => restDaysCopy(restDaysView(recovery), e.today), [recovery, e.today])
  const [picked, setPicked] = useState(null)
  const [why, setWhy] = useState(false)
  const last = e.months.length - 1
  const [month, setMonth] = useState(last)
  // Each opening starts from the top: this month, nothing picked, «ليش مو» shut.
  useEffect(() => { if (open) { setPicked(null); setWhy(false); setMonth(last) } }, [open, last])
  const pickedRow = picked ? (recovery?.ledger || []).find(r => r.date === picked) : null
  const d = e.day
  const g = e.months[Math.min(month, last)]
  const lit = rd.count > 0

  return (
    <Sheet open={open} onClose={onClose} tall title={`ليش ${e.n}؟`}>
      <div className="ss">
        <section className="ss-top">
          <div className="ss-hero">
            <span className={`ss-flame${lit ? ' glow' : ''}`}><Flame size={34} filled={lit} /></span>
            <b className={`ss-big${e.n === 0 ? ' zero' : ''}`}><Num>{e.n}</Num></b>
            <span className="ss-unit">{e.unit}</span>
            {e.whyNot && (
              <button type="button" className="ss-why" aria-expanded={why} onClick={() => setWhy(w => !w)}>
                {`ليش مو ${e.whyNot.days}؟`}<CaretDown size={12} weight="bold" aria-hidden="true" />
              </button>
            )}
          </div>
          {e.sum && (
            <p className="ss-sum" data-testid="streak-sum">
              {/* each part whole on its line: «راحة / مجدولة» never splits at 320 */}
              <span>من {e.sum.from}</span> · <span><b><Num>{e.sum.trained}</Num></b> {unitAr(e.sum.trained, 'workout')}</span>
              {e.sum.plannedRest > 0 && <> + <span><b><Num>{e.sum.plannedRest}</Num></b> راحة مجدولة</span></>}
            </p>
          )}
          {e.whyNot && why && <p className="ss-why-a" data-testid="streak-why">{e.whyNot.text}</p>}
          {e.line && <p className="ss-sum">{e.line}</p>}

          <p className={`ss-mark${d.mark.done ? ' done' : ''}`} data-testid="streak-today-mark">
            {d.mark.done ? <Check size={16} weight="bold" aria-hidden="true" /> : <Hourglass size={16} weight="bold" aria-hidden="true" />}
            <span>{d.mark.text}{d.countdown && ` · باقي ${d.countdown}`}</span>
          </p>
          {d.stake && <p className="ss-stake" data-testid="streak-stake">{d.stake}</p>}
          {d.deload && <p className="ss-note">ديلود: الحساب نفسه</p>}
        </section>

        <section className="ss-rd" data-testid="rest-days" aria-labelledby="ss-rd-h">
          <h3 id="ss-rd-h" className="ss-rd-h">
            <span className={`ss-rd-flame${lit ? ' on' : ''}`}><Flame size={18} filled={lit} /></span>
            أيام الراحة الاختيارية: <b><Num>{rd.count}</Num></b>
          </h3>
          <div className="ss-rd-next">
            <span className="ss-seg" role="progressbar" aria-label="التقدم ليوم الراحة الجاي"
              aria-valuemin={0} aria-valuemax={rd.every} aria-valuenow={rd.progress}>
              {Array.from({ length: rd.every }, (_, i) => <i key={i} className={i < rd.progress ? 'on' : ''} />)}
            </span>
            <span>{rd.next}</span>
          </div>
          {rd.rows.length > 0 && (
            <ul className="ss-rd-list">
              {rd.rows.map(r => (
                <li key={r.kind + r.date} className={r.kind} data-testid={r.kind === 'held' ? 'rest-day-held' : 'rest-day-used'}>
                  <span className="ss-rd-ic">{r.kind === 'held' ? <Moon size={14} /> : <Ticket size={14} />}</span>{r.text}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ss-cal" aria-label="يوم بيوم">
          <div className="ss-month">
            <div className="ss-month-h">
              <IconButton icon={CaretRight} label="الشهر اللي قبله" iconSize={18}
                disabled={month <= 0} onClick={() => { setMonth(m => m - 1); setPicked(null) }} />
              <span className="ss-month-label">{g.label}</span>
              <IconButton icon={CaretLeft} label="الشهر اللي بعده" iconSize={18}
                disabled={month >= last} onClick={() => { setMonth(m => m + 1); setPicked(null) }} />
            </div>
            <div className="ss-grid" role="grid">
              {WEEK.map(w => <span key={w} className="ss-wd">{w}</span>)}
              {g.cells.map((c, i) => c ? (
                <button key={c.iso} type="button"
                  className={`ss-cell k-${c.kind}${picked === c.iso ? ' picked' : ''}`}
                  disabled={c.kind === 'future'}
                  onClick={() => setPicked(c.iso)}
                  aria-label={c.row ? dayLine(c.row, e.today) : c.iso}>
                  <span className="ss-cell-n"><Num>{c.day}</Num></span>
                  <span className="ss-cell-g"><Glyph kind={c.kind} /></span>
                </button>
              ) : <span key={`b${i}`} />)}
            </div>
          </div>
          <p className="ss-picked" aria-live="polite">{pickedRow ? dayLine(pickedRow, e.today) : ''}</p>
          <p className="ss-key">
            <span><i className="ss-dot" /> تمرين</span>
            <span><span className="ss-rest"><Moon size={12} /></span> راحة مجدولة</span>
            <span><span className="ss-rest"><Ticket size={12} /></span> راحة اختيارية</span>
            <span><span className="ss-miss"><Cross size={10} /></span> انكسر</span>
          </p>
          {e.bestLine && <p className="ss-best">أفضل ستريك لك: <b><Num>{e.bestLine}</Num></b></p>}
        </section>
      </div>
    </Sheet>
  )
}
