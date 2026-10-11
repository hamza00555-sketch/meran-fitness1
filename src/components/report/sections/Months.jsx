// ── The months before ─────────────────────────────────────────
// حمزة asked to be able to go back to old reports. The last six months
// as bars of the days he trained, the one on screen in white; any bar
// with training in it opens that month's report. Older months, if
// there are any, are buttons under it. Every past report is built from
// the sessions themselves, so nothing new is stored for this.

import { Num } from '../../kit/index.jsx'
import { monthLabel, monthName } from '../../../monthReport.js'
import { Section } from '../parts.jsx'
import { unitAr } from '../../../streak.js'

const short = (m) => monthName(m)

export default function Months({ report, trail = [], older = [], onPick, id = 'rp-months' }) {
  if (!onPick || trail.filter(t => t.attended > 0).length + older.length < 2) return null
  const max = Math.max(1, ...trail.map(t => t.attended))

  return (
    <Section id={id} q="الشهور اللي فاتت">
      <div className="rp-months rp-in" style={{ '--i': 1 }} role="group" aria-label="تقارير الشهور">
        {trail.map((t) => {
          const on = t.month === report.month
          const has = t.attended > 0
          return (
            <button
              key={t.month}
              type="button"
              className={`rp-month${on ? ' is-on' : ''}`}
              disabled={!has || on}
              aria-current={on ? 'true' : undefined}
              aria-label={`تقرير ${monthLabel(t.month)} — ${t.attended} ${unitAr(t.attended, 'session')}`}
              onClick={() => onPick(t.month)}
            >
              <span className="rp-month-n">{has && <Num>{t.attended}</Num>}</span>
              <span className="rp-month-bar">
                <i style={{ height: has ? `${Math.max(6, (t.attended / max) * 100)}%` : 0 }} />
              </span>
              <span className="rp-month-l">{short(t.month)}</span>
            </button>
          )
        })}
      </div>
      {older.length > 0 && (
        <div className="rp-older rp-in" style={{ '--i': 2 }}>
          <span className="rp-eyebrow">أقدم</span>
          <div className="rp-older-list">
            {older.map(m => (
              <button key={m} type="button" className={`rp-chip${m === report.month ? ' is-on' : ''}`}
                      aria-current={m === report.month ? 'true' : undefined}
                      onClick={() => onPick(m)}>
                {monthLabel(m)}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="rp-caption rp-in" style={{ '--i': 3 }}>
        كل عمود جلساتك في شهر. اضغط على أي شهر تفتح تقريره.
      </p>
    </Section>
  )
}
