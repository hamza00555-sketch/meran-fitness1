import { useMemo, useState } from 'react'
import { Sheet, Num, Gauge } from '../kit/index.jsx'
import { explainerView, dayLine } from '../../streak.js'
import { Flame, Moon, Ticket, Cross } from './StreakIcons.jsx'
import '../../styles/streak-sheet.css'

// ── «ليش 60؟» ─────────────────────────────────────────────────
// Tapping the streak anywhere opens this. It is the answer the owner
// had to wait for an investigation to get when his 30 became a 6: the
// number as a sum, where the run began and why, what did not count,
// why it is not the calendar-day count, every day on a calendar, the
// tickets, the records and the rules — all read from the ledger that
// produced the number.

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
  const e = useMemo(
    () => explainerView({ recovery, config, active, deload, today, storedBest }),
    [recovery, config, active, deload, today, storedBest],
  )
  const [picked, setPicked] = useState(null)
  const pickedRow = picked ? (recovery?.ledger || []).find(r => r.date === picked) : null
  const v = e.view

  return (
    <Sheet open={open} onClose={onClose} tall title={`ليش ${e.n}؟`}>
      <div className="ss">
        <div className="ss-hero">
          <span className="ss-flame"><Flame size={34} filled={v.counted} /></span>
          <b className={`ss-big${e.n === 0 ? ' zero' : ''}`}><Num>{e.n}</Num></b>
          <span className="ss-unit">{e.unit}{e.stage && <> · {e.stage}</>}</span>
        </div>
        {e.sentence && <p className="ss-lead">{e.sentence}</p>}
        <p className="ss-sub">{e.startLine}</p>

        {e.equation && (
          <div className="ss-eq" aria-label={`${e.equation.trained} تمرين و${e.equation.plannedRest} راحة مجدولة يساوي ${e.equation.total}`}>
            <i className="ss-dot" /><span><b className="o"><Num>{e.equation.trained}</Num></b> تمرين</span>
            <span className="ss-op">+</span>
            <span className="ss-rest"><Moon size={14} /></span><span><b className="b"><Num>{e.equation.plannedRest}</Num></b> راحة مجدولة</span>
            <span className="ss-op">=</span>
            <b className="o"><Num>{e.equation.total}</Num></b>
          </div>
        )}
        {e.notCounted && <p className="ss-note">{e.notCounted}</p>}
        {e.whyNot && <p className="ss-sub">{e.whyNot}</p>}

        <section className="ss-sec">
          <h3>اليوم</h3>
          <p className="ss-today">{v.status}</p>
          {v.countdown && !v.lateTail && <p className="ss-sub">لين 3 الفجر · باقي <b>{v.countdown}</b>{v.cost ? <> — {v.cost}</> : null}</p>}
          {v.countdown && v.lateTail && <p className="ss-sub">باقي <b>{v.countdown}</b> على 3 الفجر · {v.lateTail}</p>}
          {!v.countdown && v.detail && <p className="ss-sub">{v.detail}</p>}
        </section>

        <section className="ss-sec">
          <h3>يوم بيوم</h3>
          {e.months.map(g => (
            <div key={g.label} className="ss-month">
              <span className="ss-month-label">{g.label}</span>
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
          ))}
          <p className="ss-picked" aria-live="polite">{pickedRow ? dayLine(pickedRow, e.today) : 'اضغط على يوم تشوف وش صار فيه.'}</p>
          <p className="ss-key">
            <i className="ss-dot" /> تمرين +1 · <span className="ss-rest"><Moon size={12} /></span> راحة مجدولة +1 · <span className="ss-rest"><Ticket size={12} /></span> تذكرة 0 · <span className="ss-miss"><Cross size={10} /></span> انكسر
          </p>
        </section>

        <section className="ss-sec">
          <h3>التذاكر</h3>
          <p className="ss-tix"><Ticket size={18} /> {e.tickets.text}</p>
          <Gauge value={e.tickets.progress} max={e.tickets.every} tone="rest" label="التقدم للتذكرة الجاية" />
          <p className="ss-sub">كل <Num>{e.tickets.every}</Num> أيام محسوبة = تذكرة · باقي {e.tickets.toNext === 1 ? 'يوم واحد' : <><Num>{e.tickets.toNext}</Num> أيام</>} للجاية</p>
          {e.tickets.spentInRun > 0 && (
            <p className="ss-sub">انصرفت في هالستريك <Num>{e.tickets.spentInRun}</Num>{e.tickets.lastPaid ? <>، آخرها {fmt(e.tickets.lastPaid)}</> : null}.</p>
          )}
        </section>

        <section className="ss-sec">
          <h3>الأرقام</h3>
          <div className="ss-rows">
            <div><span>أفضل ستريك</span><b><Num>{e.records.best}</Num>{e.records.bestIsCurrent ? ' (الحالي)' : ''}</b></div>
            {e.records.previous && (
              <div><span>اللي قبله</span><b><Num>{e.records.previous.length}</Num> · {e.records.previous.endedBy === 'settings' ? 'انتهى بتغيير الخطة' : <>انكسر {fmt(e.records.previous.breakDay)}</>}</b></div>
            )}
            {v.next && <div><span>المحطة الجاية</span><b><Num>{v.next}</Num> · باقي <Num>{v.next - e.n}</Num></b></div>}
          </div>
        </section>

        <section className="ss-sec">
          <h3>كيف ينحسب</h3>
          <ul className="ss-rules">{e.rules.map(r => <li key={r}>{r}</li>)}</ul>
        </section>
      </div>
    </Sheet>
  )
}

function fmt(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
  return `${d} ${MONTHS[m - 1]}${y !== new Date().getFullYear() ? ` ${y}` : ''}`
}
