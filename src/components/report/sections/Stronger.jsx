// ── Did you get stronger? ─────────────────────────────────────
// Answered lift by lift, in kilos on the bar — never by summing the
// month's tonnage. Every lift trained this month against the heaviest
// weight lifted in it before the month. The biggest jump leads, in
// gold: «وزن جديد» is the one word for it in the whole report, and gold
// its one colour. A lift that did not go past its best says «ما زاد» in
// grey. Deload sessions are on neither side of the comparison.
//
// This replaces the old volume chapter: the per-session average, the
// day-by-day bars with their highest and lowest day, the verdict word
// and the comparison of totals with last month are gone.

import { Num } from '../../kit/index.jsx'
import { arabicName } from '../../../exerciseMedia.js'
import { strongerLine, monthName, kgText, fromWord } from '../../../monthReport.js'
import { fmtDayAr, countAr } from '../../../streak.js'
import { Section, Gain, Bidi } from '../parts.jsx'

const MAX_ROWS = 6

function Name({ exercise, mapping, big }) {
  const ar = arabicName(exercise, mapping)
  if (big) {
    return (
      <span className="rp-best-name">
        <strong>{ar || <Num>{exercise}</Num>}</strong>
        {ar && <span className="rp-latin" dir="ltr">{exercise}</span>}
      </span>
    )
  }
  // In a row the line under the name is «كان كم وصار كم», so the Latin
  // name stays in the tooltip rather than becoming a third line.
  return <span className="rp-row-t" title={ar ? exercise : undefined}>{ar || <Num>{exercise}</Num>}</span>
}

function Jump({ pr, mapping }) {
  return (
    <div className="rp-best rp-in" style={{ '--i': 1 }}>
      <span className="rp-eyebrow">أكبر قفزة · وزن جديد</span>
      <div className="rp-best-row">
        <Name exercise={pr.exercise} mapping={mapping} big />
        <div className="rp-best-w">
          <b><Num>{kgText(pr.weight)}</Num></b><span>كجم</span>
        </div>
      </div>
      <p className="rp-best-sub">
        {fromWord(pr)} <Num>{kgText(pr.prevBest)}</Num> كجم · <Gain kg={pr.gain} />
        {pr.date && <> · يوم {fmtDayAr(pr.date, { weekday: false })}</>}
      </p>
    </div>
  )
}

function Row({ g, mapping }) {
  const up = g.gain > 0
  return (
    <li className={`rp-row${up ? ' is-up' : ''}`}>
      <span className="rp-row-main">
        <Name exercise={g.exercise} mapping={mapping} />
        <span className="rp-row-s">
          {up
            ? <>{g.firstTime ? 'بدأته هالشهر على' : 'كان'} <Num>{kgText(g.before)}</Num> · صار <Num>{kgText(g.top)}</Num> كجم</>
            : <>هالشهر <Num>{kgText(g.top)}</Num> · أثقل وزن لك <Num>{kgText(g.before)}</Num> كجم</>}
        </span>
      </span>
      <span className="rp-row-v">
        {up ? <Gain kg={g.gain} /> : <><i className="rp-flat" aria-hidden="true" /> ما زاد</>}
      </span>
    </li>
  )
}

export default function Stronger({ report, id = 'rp-stronger', mapping = {} }) {
  const { gains = [], prs = [], month } = report
  // A lift first done this month with nothing above its first session is
  // a starting point, not a lift that failed to go up.
  const rows = gains.filter(g => g.gain > 0 || !g.firstTime)
  if (!rows.length) return null

  const jump = prs[0] || null
  const rest = rows.filter(g => !jump || g.lift !== jump.lift)
  const shown = rest.slice(0, MAX_ROWS)
  const hasDeload = (report.volume?.deloadSessions || 0) > 0
  // A lift started this month has no weight from before it: its new
  // weight is measured from its first session, and the caption says so.
  const startedHere = [jump, ...shown].some(g => g && g.firstTime && (g.gain > 0))

  return (
    <Section id={id} q="صرت أقوى؟" lead={strongerLine(prs.length)}>
      {jump && <Jump pr={jump} mapping={mapping} />}
      {shown.length > 0 && (
        <ul className="rp-rows rp-in" style={{ '--i': 2 }}>
          {shown.map(g => <Row key={g.lift} g={g} mapping={mapping} />)}
        </ul>
      )}
      <p className="rp-caption rp-in" style={{ '--i': 3 }}>
        {rest.length > MAX_ROWS && <><Bidi text={`و${countAr(rest.length - MAX_ROWS, 'workout')} غير اللي فوق.`} />{' '}</>}
        الذهبي وزن جديد: أثقل من أي وزن رفعته في التمرين قبل {monthName(month)}.
        {startedHere && ' والتمرين اللي بدأته هالشهر: أثقل من أول وزن بدأت فيه.'}
        {hasDeload && ' جلسات التخفيف ما تنحسب هنا.'}
      </p>
    </Section>
  )
}
