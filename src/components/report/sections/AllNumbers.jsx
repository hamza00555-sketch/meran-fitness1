// ── Every other number ────────────────────────────────────────
// What used to be spread through the report and repeated two or three
// times — sets, reps, time in the gym, the average session, the level
// and the achievements — said once, quietly, at the end, for whoever
// wants it. None of it is the story of the month.

import { Num } from '../../kit/index.jsx'
import { durationWords } from '../../../utils.js'
import { Section, AR, Bidi } from '../parts.jsx'

function Row({ label, value, unit, sub, words }) {
  return (
    <li className="rp-row">
      <span className="rp-row-main">
        <span className="rp-row-t">{label}</span>
        {sub && <span className="rp-row-s"><Bidi text={sub} /></span>}
      </span>
      {words
        ? <span className="rp-row-v"><b><Bidi text={words} /></b></span>
        : <span className="rp-row-v"><b><Num>{value}</Num></b>{unit && ` ${unit}`}</span>}
    </li>
  )
}

export default function AllNumbers({ report, id = 'rp-all' }) {
  const { sets, reps, time, progress } = report
  const got = progress.achievements || []
  return (
    <Section id={id} q="كل الأرقام">
      <ul className="rp-rows rp-in" style={{ '--i': 1 }}>
        <Row label="مجموعات كاملة" value={AR(sets.completed)} />
        <Row label="تكرارات" value={AR(reps.total)} />
        {/* In words: «20:50 ساعة» reads as a clock, not as time spent. */}
        {time.known && <Row label="وقت التمرين" words={durationWords(time.totalMinutes)} />}
        {time.known && <Row label="متوسط الجلسة" words={durationWords(time.avgMinutes)} />}
        {/* Only today's XP is kept: in a month that has ended, the level
            is today's, and is named that way. */}
        <Row label={progress.levelIsToday ? 'مستواك اليوم' : 'المستوى'} value={progress.level}
             sub={progress.rank?.label ? `الرتبة: ${progress.rank.label}` : ''} />
        {got.length > 0 && (
          <Row label="إنجازات فتحتها" value={got.length} sub={got.slice(0, 3).map(a => a.title).join('، ') + (got.length > 3 ? '…' : '')} />
        )}
      </ul>
    </Section>
  )
}
