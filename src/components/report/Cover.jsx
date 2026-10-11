// ── The cover: how many sessions he came to ───────────────────
// حمزة chose the sessions over the tonnage for the big number. Around
// it, a ring with one dash for every session the plan asked for: lit
// for the ones he came to, dark for the ones that went missing, blue
// for the deload ones (still sessions, still attended — only lighter).
// Under it one sentence that says it in words, a line for a deload
// stretch, a line for the month's goal if he set one, and the one
// green action.
//
// Time runs right to left in the app, so the ring starts at twelve
// o'clock and runs anticlockwise: the first of the month is at the top
// right, the end of it comes round the left.

import Art, { useHasArt } from '../../assets/Art.jsx'
import { Button } from '../kit/index.jsx'
import { ShareFat, Drop } from '../kit/icons.js'
import { attendanceLine, deloadLine, goalLine } from '../../monthReport.js'
import { unitAr } from '../../streak.js'
import { Counted, Bidi, DELOAD_INK, monthOver } from './parts.jsx'

const ShareRtl = (props) => <ShareFat {...props} mirrored />

const SIZE = 216
const STROKE = 12

/** A point on the ring, `deg` anticlockwise from twelve o'clock. */
const pt = (r, deg) => {
  const a = (deg * Math.PI) / 180
  return [SIZE / 2 - r * Math.sin(a), SIZE / 2 - r * Math.cos(a)]
}

function Ring({ slots, label }) {
  const r = SIZE / 2 - STROKE / 2 - 2
  const n = slots.length
  const step = 360 / Math.max(1, n)
  const gap = Math.min(step * 0.4, Math.max(2.5, 10 - n * 0.2))
  let lit = 0
  return (
    <svg className="rp-ring" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label}>
      {n === 1 ? (
        <circle cx={SIZE / 2} cy={SIZE / 2} r={r} className={`rp-arc is-${slots[0].state}${slots[0].deload ? ' is-deload' : ''}`}
                style={slots[0].deload && slots[0].state === 'done' ? { stroke: DELOAD_INK } : undefined} />
      ) : slots.map((s, i) => {
        const a0 = i * step + gap / 2
        const a1 = (i + 1) * step - gap / 2
        const [x0, y0] = pt(r, a0)
        const [x1, y1] = pt(r, a1)
        const done = s.state === 'done'
        return (
          <path
            key={s.date}
            d={`M${x0.toFixed(2)},${y0.toFixed(2)}A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 0 ${x1.toFixed(2)},${y1.toFixed(2)}`}
            className={`rp-arc is-${s.state}${s.deload ? ' is-deload' : ''}`}
            style={{ '--i': done ? lit++ : 0, ...(s.deload && done ? { stroke: DELOAD_INK } : null) }}
          />
        )
      })}
    </svg>
  )
}

export default function Cover({ report, onShare, sharing = false, today }) {
  const hasArt = useHasArt(report.cover)
  const a = report.attendance
  const over = monthOver(report.month, today)
  const label = `${a.attended} ${unitAr(a.attended, 'session')} حضرتها${a.planned ? ` من ${a.planned} في خطتك` : ''}`

  return (
    <section className={`rp-cover rp-on${hasArt ? ' has-art' : ''}`} aria-label="غلاف الشهر">
      {hasArt && (
        <Art id={report.cover} alt="" className="rp-cover-art"
             style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      <div className="rp-cover-body">
        <p className="rp-eyebrow rp-in" style={{ '--i': 0 }}>
          تقرير الشهر · <Bidi text={report.monthLabel} />
        </p>

        <div className="rp-ring-wrap rp-in" style={{ '--i': 1 }}>
          <Ring slots={a.slots} label={label} />
          <div className="rp-ring-c" aria-hidden="true">
            <b className="rp-hero"><Counted value={a.attended} duration={1000} /></b>
            <span className="rp-hero-unit">{unitAr(a.attended, 'session')} حضرتها</span>
          </div>
        </div>

        <p className="rp-cover-line rp-in" style={{ '--i': 2 }}><Bidi text={attendanceLine(a)} /></p>

        {report.deload && (
          <p className="rp-cover-note is-deload rp-in" style={{ '--i': 3 }}>
            <Drop size={16} weight="fill" color={DELOAD_INK} aria-hidden="true" />
            <span><Bidi text={deloadLine(report.deload.ranges, report.month)} /></span>
          </p>
        )}
        {report.goal && (
          <p className={`rp-cover-note rp-in${report.goal.reached ? ' is-reached' : ''}`} style={{ '--i': 3 }}>
            <span><Bidi text={goalLine(report.goal, { over })} /></span>
          </p>
        )}

        <Button
          variant="primary" size="lg" full icon={ShareRtl}
          className="rp-cover-cta rp-in" style={{ '--i': 4 }}
          onClick={onShare} disabled={sharing}
        >
          {sharing ? 'نجهّز الصورة…' : 'شارك شهرك'}
        </Button>
      </div>
    </section>
  )
}
