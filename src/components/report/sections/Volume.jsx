// ── Chapter 02: what you moved ────────────────────────────────
// The month's total is already the cover, so this chapter does not say
// it again. It opens on the average session and the comparison with
// last month, then the month day by day on a real calendar, the
// figures behind it, and the records — «أقوى رقم» is the one gold thing
// in the whole report, because gold means a weight that went up.

import { ArrowUp, ArrowDown, Drop, Minus } from '../../kit/icons.js'
import { Num } from '../../kit/index.jsx'
import { arabicName } from '../../../exerciseMedia.js'
import { prevMonth, monthLabel } from '../../../monthReport.js'
import { Chapter, Figure, AR } from '../parts.jsx'
import TrendChart, { monthVerdict, DELOAD_INK } from '../TrendChart.jsx'

const monthName = (m) => monthLabel(m).split(' ')[0]
const kg = (n) => AR(Math.round(n * 10) / 10)

function Verdict({ v }) {
  if (!v) return null
  if (v.dir === 'flat') {
    return <span className="rp-verdict"><Minus size={14} weight="bold" aria-hidden="true" />ثابت</span>
  }
  const up = v.dir === 'up'
  const Icon = up ? ArrowUp : ArrowDown
  return (
    <span className={`rp-verdict${up ? ' is-up' : ''}`}>
      <Icon size={14} weight="bold" aria-hidden="true" />
      <Num>{Math.abs(v.pct)}%</Num> خلال الشهر
    </span>
  )
}

function Lift({ pr, mapping, best }) {
  const ar = arabicName(pr.exercise, mapping)
  const gain = Math.round((pr.weight - pr.prevBest) * 10) / 10
  if (best) {
    return (
      <div className="rp-best rp-in" style={{ '--i': 6 }}>
        <span className="rp-eyebrow">أقوى رقم</span>
        <div className="rp-best-row">
          <div className="rp-best-name">
            <strong>{ar || <Num>{pr.exercise}</Num>}</strong>
            {ar && <span className="rp-latin" dir="ltr">{pr.exercise}</span>}
          </div>
          <div className="rp-best-w">
            <b><Num>{kg(pr.weight)}</Num></b><span>كجم</span>
          </div>
        </div>
        <p className="rp-best-sub">
          كان <Num>{kg(pr.prevBest)}</Num> كجم · <Num>+{kg(gain)}</Num> كجم
          {pr.steps > 1 && <> على <Num>{pr.steps}</Num> جلسات</>}
        </p>
      </div>
    )
  }
  return (
    <li className="rp-row">
      <span className="rp-row-main">
        <span className="rp-row-t">{ar || <Num>{pr.exercise}</Num>}</span>
        {ar && <span className="rp-latin rp-row-s" dir="ltr">{pr.exercise}</span>}
      </span>
      <span className="rp-row-v">
        <b><Num>{kg(pr.weight)}</Num></b> كجم
        <small><Num>+{kg(gain)}</Num></small>
      </span>
    </li>
  )
}

export default function Volume({ report, n = 2, id = 'rp-volume', mapping = {} }) {
  const { volume, sets, reps, time, prs, sessionCount, month } = report
  const trend = volume.trendPct
  const verdict = monthVerdict(volume.series || [])
  const values = (volume.series || []).map(p => p.value)
  const prev = monthName(prevMonth(month))

  // The two verdicts answer different questions — this month against
  // the last, and which way the days leaned inside this one. When they
  // point opposite ways the card says so, or it reads as broken.
  const disagree = trend !== null && verdict && verdict.dir !== 'flat' &&
    ((trend >= 5 && verdict.dir === 'down') || (trend <= -5 && verdict.dir === 'up'))

  return (
    <Chapter id={id} n={n} title="الحجم" note="الوزن × التكرار، لكل مجموعة مكتملة.">
      <div className="rp-lead rp-in" style={{ '--i': 1 }}>
        <p className="rp-lead-main">
          بمعدل <b><Num>{AR(volume.perSession)}</Num></b> كجم لكل جلسة
        </p>
        {trend !== null && (
          <p className={`rp-lead-cmp${trend > 0 ? ' is-up' : ''}`}>
            {trend > 0 ? <ArrowUp size={16} weight="bold" aria-hidden="true" />
              : trend < 0 ? <ArrowDown size={16} weight="bold" aria-hidden="true" />
              : <Minus size={16} weight="bold" aria-hidden="true" />}
            <span>
              {trend === 0 ? 'نفس' : <Num>{Math.abs(trend)}%</Num>} {trend > 0 ? 'أكثر من' : trend < 0 ? 'أقل من' : ''} {prev}
              <span className="rp-muted"> (<Num>{AR(volume.prevTotal)}</Num> كجم)</span>
            </span>
          </p>
        )}
      </div>

      {values.length > 0 && (
        <div className="rp-block rp-in" style={{ '--i': 2 }}>
          <div className="rp-block-h">
            <span className="rp-eyebrow">حجم كل يوم</span>
            <Verdict v={verdict} />
          </div>
          <TrendChart series={volume.series} month={month} verdict={verdict} />
          <p className="rp-caption">
            أعلى يوم <Num>{AR(Math.max(...values))}</Num> كجم · أدنى يوم <Num>{AR(Math.min(...values))}</Num> كجم
          </p>
          {volume.deloadDays > 0 && (
            <p className="rp-caption rp-deload-note">
              <Drop size={16} weight="fill" color={DELOAD_INK} aria-hidden="true" />
              المظلّل أيام ديلود — خفيفة بقصد، وما تدخل في الحكم.
            </p>
          )}
          {disagree && (
            <p className="rp-caption">
              {trend > 0
                ? `مجموع الشهر أعلى من ${prev}، لكن أيامك داخل الشهر كانت تخف شوي شوي.`
                : `مجموع الشهر أقل من ${prev}، لكن أيامك داخل الشهر كانت تثقل شوي شوي.`}
            </p>
          )}
        </div>
      )}

      <div className="rp-figs">
        <Figure value={sessionCount} label="جلسة" i={3} />
        <Figure value={sets.completed} label="مجموعة مكتملة" i={3} />
        <Figure value={reps.total} label="تكرار" i={3} />
        {time.known && <Figure value={time.totalMinutes} label="دقيقة في الجيم" i={4} />}
        {time.known && <Figure value={time.avgMinutes} label="دقيقة للجلسة" i={4} />}
      </div>

      {sets.untrackedPct > 0 && (
        <p className="rp-caption rp-in" style={{ '--i': 5 }}>
          <Num>{sets.untrackedPct}%</Num> من مجموعاتك بدون علامة إكمال، وما انحسبت في التكرارات.
        </p>
      )}

      {prs.length > 0 && (
        <>
          <Lift pr={prs[0]} mapping={mapping} best />
          {prs.length > 1 && (
            <div className="rp-more rp-in" style={{ '--i': 7 }}>
              <span className="rp-eyebrow">
                {prs.length === 2 ? 'وزن ثاني ارتفع' : <><Num>{prs.length - 1}</Num> أوزان ثانية ارتفعت</>}
              </span>
              <ul className="rp-rows">
                {prs.slice(1, 6).map(pr => <Lift key={`${pr.exercise}-${pr.date}`} pr={pr} mapping={mapping} />)}
              </ul>
              {prs.length > 6 && (
                <p className="rp-caption">و<Num>{prs.length - 6}</Num> غيرها</p>
              )}
            </div>
          )}
        </>
      )}
    </Chapter>
  )
}
