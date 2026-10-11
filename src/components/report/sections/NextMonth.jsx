// ── Next month's plan ─────────────────────────────────────────
// Where the advice lives now: at the end, after he has seen what the
// month was (حمزة chose this over the top of the report). Three things
// at most, each one line of what to do and one plain line of why, all
// read off the progression engine and the sets-per-week range:
// «ارفع», «زِد مجموعات», «نزّل». No severity colours, no «الدليل:», no
// generic form tips — every line comes from his own month.

import { ArrowUp, ArrowDown, Plus } from '../../kit/icons.js'
import { nextCopy, countWord, monthName, nextMonth } from '../../../monthReport.js'
import { Section, Bidi } from '../parts.jsx'

const ICON = { raise: ArrowUp, sets: Plus, lower: ArrowDown }

export default function NextMonth({ report, id = 'rp-next', mapping = {} }) {
  const items = report.next || []
  const lead = items.length
    ? `${countWord(items.length, 'thing')} للشهر الجاي.`
    : 'كمّل زي ما أنت، ما فيه شي يحتاج يتغيّر.'

  return (
    <Section id={id} q={`خطة ${monthName(nextMonth(report.month))}`} lead={lead}>
      {items.length > 0 && (
        <ol className="rp-next">
          {items.map((item, i) => {
            const c = nextCopy(item, mapping)
            const Icon = ICON[item.kind] || Plus
            return (
              <li key={`${item.kind}-${item.exercise || item.muscle}`} className="rp-next-item rp-in"
                  style={{ '--i': i + 1 }} data-kind={item.kind}>
                <span className="rp-next-ic" aria-hidden="true"><Icon size={18} weight="bold" /></span>
                <span className="rp-next-main">
                  <strong><Bidi text={c.title} /></strong>
                  <span><Bidi text={c.reason} /></span>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </Section>
  )
}
