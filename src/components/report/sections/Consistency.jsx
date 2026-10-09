// ── Chapter 03: whether you showed up ─────────────────────────
// One number and what it is made of: the share of the month's days that
// went as the plan said (a session on a training day, or a planned
// rest), then the streak — in the same unit and colour as the flame on
// Home — then the month on a calendar drawn with Home's own glyphs.
// Every day is classified by the recovery engine, not by this file.
//
// The session-only run the report used to call «أطول سلسلة» is still
// here, renamed «أطول تتابع جلسات» and kept grey: it counts something
// else, and giving it the flame's name and colour is how the same month
// came to read 31 on Home and 16 here.

import { useState } from 'react'
import { Gauge, Num } from '../../kit/index.jsx'
import { Flame, Moon, Ticket, Cross } from '../../streak/StreakIcons.jsx'
import { unitAr, fmtDayAr } from '../../../streak.js'
import { monthLabel } from '../../../monthReport.js'
import { Chapter, Figure, monthOver } from '../parts.jsx'
import { DELOAD_INK } from '../TrendChart.jsx'

const KIND = {
  trained: 'تمرّنت',
  rest:    'راحة مجدولة',
  paid:    'راحة بتذكرة',
  miss:    'غياب',
}

const WEEK = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'] // Sunday first

function Glyph({ kind }) {
  if (kind === 'trained') return <i className="rp-dot" />
  if (kind === 'rest') return <span className="is-rest"><Moon size={14} /></span>
  if (kind === 'paid') return <span className="is-rest"><Ticket size={14} /></span>
  return <span className="is-miss"><Cross size={11} /></span>
}

// «3 جلسات», «12 جلسة» — the plural only for 3–10, like countAr.
const sessionsWord = (n) => { const r = n % 100; return n === 0 || (r >= 3 && r <= 10) ? 'جلسات' : 'جلسة' }

const span = (s) =>`${fmtDayAr(s.start, { weekday: false })} — ${fmtDayAr(s.end, { weekday: false })}`

function Runs({ streaks }) {
  if (!streaks?.month && !streaks?.prevMonth && !streaks?.allTime) return null
  const rows = [
    ['هذا الشهر', streaks.month],
    ['الشهر الماضي', streaks.prevMonth],
    ['الأطول لك', streaks.allTime],
  ]
  const isRecord = streaks.month && streaks.allTime && streaks.month.days === streaks.allTime.days
  return (
    <div className="rp-block rp-in" style={{ '--i': 5 }}>
      <span className="rp-eyebrow">أطول تتابع جلسات</span>
      <ul className="rp-rows">
        {rows.map(([label, s]) => (
          <li key={label} className="rp-row">
            <span className="rp-row-main">
              <span className="rp-row-t">{label}</span>
              {s && (
                <span className="rp-row-s">
                  {span(s)}{s.ongoing ? ' · مستمر' : ''}
                </span>
              )}
            </span>
            <span className="rp-row-v">
              {s ? <><b><Num>{s.days}</Num></b> {sessionsWord(s.days)}</> : <span className="rp-muted">—</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="rp-caption">
        جلسات ورا بعض بدون غياب — يوم الراحة ما يقطعها وما ينحسب منها.
        {isRecord && ' وهذا الشهر وصلت أطول تتابع لك.'}
      </p>
      {streaks.carried && (
        <p className="rp-caption">
          بدأ هالتتابع الشهر اللي قبله في {fmtDayAr(streaks.carried.start, { weekday: false })} واستمر <Num>{streaks.carried.span}</Num> يوم على التقويم.
        </p>
      )}
    </div>
  )
}

export default function Consistency({ report, n = 3, id = 'rp-consistency', liveStreak = null, today }) {
  const c = report.consistency
  const total = c.calendar.length || 1
  const onPlan = c.trainedDays + c.scheduledRests
  const pct = Math.round((onPlan / total) * 100)
  const [picked, setPicked] = useState(null)

  // The streak at the end of the month, or — while the month is still
  // running — the live number, if the app passed it in. Never a guess.
  const over = monthOver(report.month, today)
  const streak = over ? c.endStreak : liveStreak
  const monthName = monthLabel(report.month).split(' ')[0]

  // The first of the month may not be a Sunday; pad so the columns line
  // up with their weekday headings.
  const firstDay = c.calendar.length
    ? (() => { const [y, m, d] = c.calendar[0].date.split('-').map(Number); return new Date(y, m - 1, d).getDay() })()
    : 0
  const pickedDay = picked && c.calendar.find(d => d.date === picked)

  return (
    <Chapter id={id} n={n} title="الالتزام" note="كل يوم مصنّف بنفس المحرك اللي يحسب الستريك.">
      <div className="rp-commit rp-in" style={{ '--i': 1 }}>
        <div className="rp-commit-n">
          <b><Num>{pct}%</Num></b>
          <span>من أيام الخطة</span>
        </div>
        <Gauge value={onPlan} max={total} tone="accent" label={`${pct}% من أيام الخطة`} />
        <p className="rp-caption">
          <Num>{onPlan}</Num> من <Num>{total}</Num> يوم مشت مثل ما تقول الخطة: تمرين في يومه، أو راحة مجدولة.
        </p>
      </div>

      <div className="rp-figs is-four">
        <Figure value={c.trainedDays} label="يوم تمرين" i={2} />
        <Figure value={c.scheduledRests} label="راحة مجدولة" i={2} />
        <Figure value={c.paidRests} label="راحة بتذكرة" tone={c.paidRests ? 'rest' : undefined} i={2} />
        <Figure value={c.missedDays.length} label="يوم غياب" i={2} />
      </div>

      {Number.isFinite(streak) && (
        <div className="rp-block rp-in" style={{ '--i': 3 }}>
          <span className="rp-eyebrow">الستريك {over ? `آخر ${monthName}` : 'لين اليوم'}</span>
          <div className="rp-streak">
            <span className="rp-streak-flame"><Flame size={30} filled={streak > 0} /></span>
            <b className={streak === 0 ? 'zero' : undefined}><Num>{streak}</Num></b>
            <span className="rp-streak-unit">{unitAr(streak, 'day')}</span>
          </div>
          <p className="rp-caption">أيام التزامك بالخطة — تمرين أو راحة مجدولة. التذكرة توقفه وما تزيده.</p>
        </div>
      )}

      <div className="rp-block rp-in" style={{ '--i': 4 }}>
        <span className="rp-eyebrow">الشهر يوم بيوم</span>
        <div className="rp-cal" role="grid" aria-label={`أيام ${monthLabel(report.month)}`}>
          {WEEK.map(w => <span key={w} className="rp-cal-wd" aria-hidden="true">{w}</span>)}
          {Array.from({ length: firstDay }, (_, i) => <span key={`pad${i}`} aria-hidden="true" />)}
          {c.calendar.map(day => {
            const label = `${day.date} — ${KIND[day.kind] || KIND.miss}${day.deload ? ' · ديلود' : ''}`
            return (
              <button
                key={day.date}
                type="button"
                title={label}
                aria-label={`${fmtDayAr(day.date)} — ${KIND[day.kind] || KIND.miss}${day.deload ? ' · ديلود' : ''}`}
                aria-pressed={picked === day.date}
                className={`rp-cal-cell k-${day.kind}${day.deload ? ' is-deload' : ''}${picked === day.date ? ' picked' : ''}`}
                onClick={() => setPicked(p => (p === day.date ? null : day.date))}
              >
                <span className="rp-cal-n"><Num>{Number(day.date.slice(8))}</Num></span>
                <span className="rp-cal-g"><Glyph kind={day.kind} /></span>
              </button>
            )
          })}
        </div>
        <p className="rp-cal-picked" aria-live="polite">
          {pickedDay
            ? <>{fmtDayAr(pickedDay.date)} — {KIND[pickedDay.kind] || KIND.miss}{pickedDay.deload ? ' · أسبوع ديلود' : ''}</>
            : 'اضغط على يوم تشوف وش صار فيه.'}
        </p>
        <p className="rp-key">
          <span><i className="rp-dot" /> تمرين</span>
          <span><span className="is-rest"><Moon size={12} /></span> راحة مجدولة</span>
          <span><span className="is-rest"><Ticket size={12} /></span> تذكرة</span>
          <span><span className="is-miss"><Cross size={10} /></span> غياب</span>
          {c.calendar.some(d => d.deload) && (
            <span><i className="rp-key-deload" style={{ borderColor: DELOAD_INK }} /> ديلود</span>
          )}
        </p>
      </div>

      <Runs streaks={c.streaks} />

      {c.restCredits > 0 && (
        <p className="rp-tickets rp-in" style={{ '--i': 6 }}>
          <Ticket size={18} />
          <span>{over ? 'رصيدك آخر الشهر' : 'رصيدك الحين'}: <b><Num>{c.restCredits}</Num> {unitAr(c.restCredits, 'ticket')}</b></span>
        </p>
      )}
    </Chapter>
  )
}
