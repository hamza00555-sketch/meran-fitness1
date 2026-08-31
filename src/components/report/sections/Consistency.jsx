// ── Section 3: whether you showed up ──────────────────────────
// The month as a grid of days, filling in as a wave sweeps across it.
// Every cell is classified by the recovery engine, not by this file, so
// what it shows here is exactly what the streak was judged on.

import { useReveal } from '../../../hooks/useMotion.js'
import { Heading, Tile, AR } from '../parts.jsx'
import Ring from '../Ring.jsx'

const KIND = {
  trained: { color: 'var(--cyan)',   label: 'تمرّنت' },
  rest:    { color: 'var(--purple)', label: 'راحة مجدولة' },
  paid:    { color: 'var(--gold)',   label: 'راحة اختيارية' },
  miss:    { color: '#3A2030',       label: 'غياب' },
}

// A deload is a modifier on a day, not a kind of day: it rims the cell
// and leaves the fill saying what the day actually was. A missed day
// inside a deload is still a missed day. The colour is a literal
// because the report is usually read after the period ended, when the
// app's accent is green again.
const DELOAD_INK = '#5CC9EE'

const WEEK = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت']

const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

// "2026-08-25" → "25 أغسطس". Parsed by hand rather than through Date,
// which would read a bare ISO date as UTC and slide it a day back for
// anyone east of Greenwich.
const dayLabel = (iso) => {
  const [, m, d] = String(iso).split('-')
  return `${AR(Number(d))} ${MONTHS[Number(m) - 1] || ''}`.trim()
}

// ── How long you kept it up, in three answers ─────────────────
//
// One number could not say whether this month beat the last one, or
// whether either came near your own record — so it said none of it.
// Runs are measured across the whole ledger, so a streak that began
// before the 1st is reported at its true length rather than at the
// slice of it that happens to fall inside this month.
function Streaks({ streaks, run }) {
  if (!streaks?.month && !streaks?.prevMonth && !streaks?.allTime) return null
  const rows = [
    { key: 'month',     label: 'هذا الشهر',        s: streaks.month,     color: 'var(--cyan)' },
    { key: 'prevMonth', label: 'الشهر الماضي',     s: streaks.prevMonth, color: 'var(--text2)' },
    { key: 'allTime',   label: 'الأطول على الإطلاق', s: streaks.allTime,   color: 'var(--gold)' },
  ]
  const isRecord = streaks.month && streaks.allTime && streaks.month.days === streaks.allTime.days

  return (
    <div
      className={run ? 'mr-rise' : undefined}
      style={{
        '--i': 4, marginBottom: 14, opacity: run ? undefined : 0,
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '12px 14px',
      }}
    >
      <div style={{
        fontFamily: 'var(--font-ar)', fontSize: 12, fontWeight: 800,
        color: 'var(--text2)', marginBottom: 2,
      }}>أطول سلسلة</div>
      {/* Without this, the number looks wrong to the person who lived
          it: they count the days they trained, and the streak counts
          every day they did what the week asked. */}
      <div style={{
        fontFamily: 'var(--font-ar)', fontSize: 10, color: 'var(--text3)',
        lineHeight: 1.7, marginBottom: 8,
      }}>
        يوم الراحة المجدولة محسوب من السلسلة · يوم الراحة الاختياري يحفظها بلا زيادة
      </div>

      {rows.map(({ key, label, s, color }) => (
        <div key={key} style={{
          display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 0',
        }}>
          <span style={{ flex: 1, fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)' }}>
            {label}
          </span>
          {s ? (
            <>
              <span style={{ fontFamily: 'var(--font-ar)', fontSize: 10, color: 'var(--text3)' }}>
                {dayLabel(s.start)} — {dayLabel(s.end)}
              </span>
              <span style={{
                fontFamily: 'var(--font-ar)', fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap',
              }}>منها {AR(s.trained)} تمرين</span>
              <b style={{
                fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 800, color,
                fontVariantNumeric: 'tabular-nums',
              }}>{AR(s.days)}</b>
            </>
          ) : (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text3)' }}>—</span>
          )}
        </div>
      ))}

      {isRecord && (
        <div style={{
          marginTop: 6, fontFamily: 'var(--font-ar)', fontSize: 11,
          color: 'var(--gold)', fontWeight: 700,
        }}>🏆 رقمك القياسي — ما وصلت له من قبل</div>
      )}

      {/* One run on both sides of the 1st. Without saying so, the same
          number appearing twice reads as two separate achievements. */}
      {streaks.carried && (
        <div style={{
          marginTop: 6, fontFamily: 'var(--font-ar)', fontSize: 11,
          color: 'var(--text2)', lineHeight: 1.7,
        }}>
          🔗 سلسلة واحدة ممتدة من الشهر الماضي — بدأت {dayLabel(streaks.carried.start)}
          {' '}واستمرت {AR(streaks.carried.span)} يوماً على التقويم
        </div>
      )}
    </div>
  )
}

export default function Consistency({ report }) {
  const [ref, run, active] = useReveal()
  const c = report.consistency
  const totalDays = c.calendar.length || 1

  // The first of the month may not be a Sunday; pad so the columns line
  // up with their weekday headings.
  const firstDay = c.calendar.length
    ? new Date(...c.calendar[0].date.split('-').map((v, i) => (i === 1 ? Number(v) - 1 : Number(v)))).getDay()
    : 0

  return (
    <section ref={ref} className={`mr-section${active ? '' : ' mr-idle'}`} style={{ marginBottom: 34 }}>
      <Heading run={run} note="كل يوم مصنّف كما صنّفه محرّك الالتزام نفسه">
        الالتزام
      </Heading>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        marginBottom: 16, flexWrap: 'wrap', justifyContent: 'center',
      }}>
        <Ring
          value={c.trainedDays + c.scheduledRests}
          max={totalDays}
          run={run}
          label={AR(c.bestStreak)}
          sub="أطول سلسلة"
          color="var(--cyan)"
        />
        <div style={{ flex: 1, minWidth: 150, display: 'grid', gap: 8 }}>
          <Tile value={c.trainedDays} label="يوم تمرين" run={run} i={1} color="var(--cyan)" />
          <Tile value={c.paidRests} label="راحة اختيارية" run={run} i={2} color="var(--gold)" />
          <Tile value={c.missedDays.length} label="يوم غياب" run={run} i={3}
                color={c.missedDays.length ? '#EF4444' : 'var(--text)'} />
        </div>
      </div>

      <Streaks streaks={c.streaks} run={run} />

      {/* ── The month ── */}
      <div
        className={run ? 'mr-rise mr-shine' : undefined}
        style={{
          '--i': 4, position: 'relative', overflow: 'hidden',
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 14, opacity: run ? undefined : 0,
        }}
      >
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 5, marginBottom: 6,
        }}>
          {WEEK.map(d => (
            <div key={d} style={{
              fontSize: 9, color: 'var(--text3)', textAlign: 'center',
              fontFamily: 'var(--font-ar)',
            }}>{d}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
          {Array.from({ length: firstDay }, (_, i) => <div key={`pad${i}`} />)}
          {c.calendar.map((day, i) => {
            const k = KIND[day.kind] || KIND.miss
            return (
              <div
                key={day.date}
                className={run ? 'mr-cell' : undefined}
                title={`${day.date} — ${k.label}${day.deload ? ' · ديلود' : ''}`}
                style={{
                  '--i': i,
                  aspectRatio: '1', borderRadius: 6,
                  background: day.kind === 'miss' ? k.color : `${k.color}33`,
                  border: `1px solid ${day.deload ? DELOAD_INK : day.kind === 'miss' ? '#4A2838' : k.color}`,
                  boxShadow: day.deload
                    ? `inset 0 0 0 2px ${DELOAD_INK}22`
                    : day.kind === 'trained' ? `0 0 6px ${k.color}66` : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: day.kind === 'miss' ? '#8A5A70' : k.color,
                  fontWeight: 700, opacity: run ? undefined : 0,
                }}
              >
                {Number(day.date.slice(8))}
              </div>
            )
          })}
        </div>

        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 10,
          marginTop: 12, justifyContent: 'center',
        }}>
          {report.volume?.deloadDays > 0 && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-ar)',
            }}>
              <span style={{
                width: 9, height: 9, borderRadius: 2,
                border: `1.5px solid ${DELOAD_INK}`,
              }} />
              ديلود
            </span>
          )}
          {Object.entries(KIND).map(([key, k]) => (
            <span key={key} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-ar)',
            }}>
              <span style={{
                width: 9, height: 9, borderRadius: 3,
                background: key === 'miss' ? k.color : `${k.color}55`,
                border: `1px solid ${key === 'miss' ? '#4A2838' : k.color}`,
              }} />
              {k.label}
            </span>
          ))}
        </div>
      </div>

      {c.restCredits > 0 && (
        <div
          className={run ? 'mr-rise' : undefined}
          style={{
            '--i': 5, marginTop: 10, textAlign: 'center',
            fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--gold)',
            opacity: run ? undefined : 0,
          }}
        >
          🎟️ رصيدك في نهاية الشهر: {AR(c.restCredits)} {c.restCredits === 1 ? 'يوم راحة' : 'أيام راحة'}
        </div>
      )}
    </section>
  )
}
