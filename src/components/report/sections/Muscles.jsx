// ── Where did the work go? ────────────────────────────────────
// One bar per muscle: how many completed sets it got a week, on the
// month's average. The lighter band is 10 to 20 — the range a muscle
// grows in, the same one the plan builder uses. A muscle under the band
// is drawn white with «أقل من اللازم» beside it; the rest stay grey.
// Neutral ink only: orange belongs to the streak, green to the action.
//
// This replaces the share-of-tonnage bars, the «most/least» line under
// them and the push/pull ratio: a number of sets is something you can
// add to a plan, «45% of the volume» and «1.52 : 1» are not.

import { Num } from '../../kit/index.jsx'
import { musclesLine, WEEKLY_SETS } from '../../../monthReport.js'
import { Section } from '../parts.jsx'

export default function Muscles({ report, id = 'rp-muscles' }) {
  const rows = report.muscles || []
  if (!rows.length) return null

  // One scale for every row, a little past the band so it reads as a
  // band and not as the end of the track.
  const top = Math.max(WEEKLY_SETS.max + 4, Math.ceil(Math.max(...rows.map(m => m.perWeek)) / 4) * 4)
  const at = (v) => `${(Math.min(v, top) / top) * 100}%`
  const band = { insetInlineStart: at(WEEKLY_SETS.min), width: `${((WEEKLY_SETS.max - WEEKLY_SETS.min) / top) * 100}%` }

  return (
    <Section id={id} q="وين راح شغلك؟" lead={musclesLine(rows)}>
      <div className="rp-sets rp-in" style={{ '--i': 1 }}>
        <div className="rp-sets-scale" aria-hidden="true">
          <span />
          <span className="rp-sets-ticks">
            <i style={{ insetInlineStart: at(WEEKLY_SETS.min) }}><Num>{WEEKLY_SETS.min}</Num></i>
            <i style={{ insetInlineStart: at(WEEKLY_SETS.max) }}><Num>{WEEKLY_SETS.max}</Num></i>
          </span>
          <span />
        </div>
        <ul>
          {rows.map((m, i) => {
            const low = m.status === 'low'
            const n = m.shown ?? Math.round(m.perWeek)
            return (
              <li key={m.key} className={`rp-sets-row${low ? ' is-low' : ''}`}
                  aria-label={`${m.label}: ${n} مجموعة بالأسبوع${low ? '، أقل من اللازم' : ''}`}>
                <span className="rp-sets-l">{m.label}</span>
                <span className="rp-sets-track" aria-hidden="true">
                  {m.status && <i className="rp-sets-band" style={band} />}
                  <i className="rp-sets-fill" style={{ width: at(Math.max(n, 0.4)), '--i': i }} />
                </span>
                <span className="rp-sets-v"><Num>{n}</Num></span>
                {low && <span className="rp-sets-note">أقل من اللازم</span>}
              </li>
            )
          })}
        </ul>
      </div>
      <p className="rp-caption rp-in" style={{ '--i': 2 }}>
        كم مجموعة كاملة أخذت كل عضلة بالأسبوع. المنطقة الفاتحة من <Num>{WEEKLY_SETS.min}</Num> إلى <Num>{WEEKLY_SETS.max}</Num>: المدى اللي تكبر فيه العضلة.
      </p>
    </Section>
  )
}
