// ── When did you train? ───────────────────────────────────────
// The streak as one number — the flame, the number, «يوم/أيام», exactly
// as Home shows it — then the month on a calendar. A trained day is lit,
// and lit brighter the more kilos it moved (five steps, the month's
// lightest ordinary day to its heaviest). A rest day is empty, a missed
// workout day has a ✕, a missed one a ticket paid for has the small
// blue ticket (the sentence above names it, so it has to be findable),
// a deload day has the blue rim and stays out of the light scale. One
// line of key instead of the symbols explained one by one.
//
// Every day is classified by the recovery engine, not by this file. The
// session-run rows, the 100% «of plan days», the four counts and the
// ticket balance are gone: three of them said the same thing as the
// streak, and the balance is a figure for today, not for this month.

import { Num } from '../../kit/index.jsx'
import { Flame, Ticket, Cross } from '../../streak/StreakIcons.jsx'
import { unitAr, countAr, fmtDayAr } from '../../../streak.js'
import { calendarLine, monthLabel, monthName } from '../../../monthReport.js'
import { Section, Bidi, DELOAD_INK, monthOver } from '../parts.jsx'

const WEEK = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'] // Sunday first

const KIND = {
  trained: 'تمرّنت',
  rest:    'راحة',
  paid:    'تذكرة بدل يوم فاتك',
  miss:    'فاتك',
  ahead:   'لسا ما جا',
  none:    'قبل ما تبدأ',
}

// Words for the light step, for anyone who cannot see it.
const LIGHT = ['', 'أخف يوم', 'خفيف', 'متوسط', 'ثقيل', 'أثقل يوم']

function cellLabel(day) {
  const parts = [fmtDayAr(day.date), KIND[day.kind] || '']
  if (day.kind === 'trained' && day.level) parts.push(LIGHT[day.level])
  if (day.deload) parts.push('تخفيف')
  return parts.filter(Boolean).join(' · ')
}

export default function Consistency({ report, id = 'rp-when', liveStreak = null, today }) {
  const c = report.consistency
  // The streak at the end of the month, or — while the month is still
  // running — the live number Home shows. Never a guess.
  const over = monthOver(report.month, today)
  const streak = over ? c.endStreak : (liveStreak ?? c.endStreak)
  const hasDeload = c.calendar.some(d => d.deload)

  // The first of the month may not be a Sunday; pad so the columns line
  // up with their weekday headings.
  const [y, m] = report.month.split('-').map(Number)
  const pad = new Date(y, m - 1, 1).getDay()

  return (
    <Section id={id} q="متى تمرّنت؟" lead={calendarLine(c.calendar)}>
      {Number.isFinite(streak) && (
        <div className="rp-block rp-in" style={{ '--i': 1 }}>
          <span className="rp-eyebrow">الستريك {over ? `آخر ${monthName(report.month)}` : 'اليوم'}</span>
          <div className="rp-streak" aria-label={`الستريك ${streak} ${unitAr(streak, 'day')}`}>
            <span className="rp-streak-flame"><Flame size={30} filled={streak > 0} /></span>
            <b className={streak === 0 ? 'zero' : undefined}><Num>{streak}</Num></b>
            <span className="rp-streak-unit">{unitAr(streak, 'day')}</span>
          </div>
        </div>
      )}

      <div className="rp-block rp-in" style={{ '--i': 2 }}>
        <div className="rp-cal" role="list" aria-label={`أيام ${monthLabel(report.month)}`}>
          {WEEK.map(w => <span key={w} className="rp-cal-wd" aria-hidden="true">{w}</span>)}
          {Array.from({ length: pad }, (_, i) => <span key={`pad${i}`} aria-hidden="true" />)}
          {c.calendar.map((day, i) => (
            <span
              key={day.date}
              role="listitem"
              title={cellLabel(day)}
              aria-label={cellLabel(day)}
              className={`rp-cal-cell k-${day.kind}${day.deload ? ' is-deload' : ''}`}
              data-level={day.kind === 'trained' && day.level ? day.level : undefined}
              style={{ '--i': i }}
            >
              <span className="rp-cal-n"><Num>{Number(day.date.slice(8))}</Num></span>
              <span className="rp-cal-g">
                {day.kind === 'trained' && (
                  <i className={`rp-lit${day.level ? '' : ' is-deload'}`} data-level={day.level || undefined}
                     style={day.level ? undefined : { background: DELOAD_INK }} />
                )}
                {day.kind === 'miss' && <span className="is-miss"><Cross size={11} /></span>}
                {day.kind === 'paid' && <span className="is-paid"><Ticket size={12} /></span>}
              </span>
            </span>
          ))}
        </div>
        <p className="rp-key">
          <span><i className="rp-lit" data-level="3" /> تمرّنت، وكل ما نوّر أكثر كان أثقل</span>
          <span><i className="rp-key-empty" /> راحة</span>
          <span><span className="is-miss"><Cross size={10} /></span> فاتك</span>
          {c.paidRests > 0 && <span><span className="is-paid"><Ticket size={11} /></span> تذكرة بدل يوم فاتك</span>}
          {hasDeload && <span><i className="rp-key-deload" style={{ borderColor: DELOAD_INK }} /> تخفيف</span>}
        </p>
      </div>

      {c.paidRests > 0 && (
        <p className="rp-tickets rp-in" style={{ '--i': 3 }}>
          <Ticket size={18} />
          <span><Bidi text={c.paidRests === 1
            ? 'انصرفت تذكرة وحدة هالشهر بدل يوم فاتك، والستريك ما انكسر.'
            : `انصرفت ${countAr(c.paidRests, 'ticket')} هالشهر بدل أيام فاتتك، والستريك ما انكسر.`} /></span>
        </p>
      )}
    </Section>
  )
}
