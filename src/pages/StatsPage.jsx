import { useMemo } from 'react'
import { ChartLineUp } from '@phosphor-icons/react'
import { Num, Weight, Chapter, EmptyState } from '../components/kit/index.jsx'
import BarChart from '../components/BarChart.jsx'
import { sessionVolume, setCounts } from '../sets.js'
import { dayKey, todayKey, dayStart } from '../day.js'
import { arabicName } from '../exerciseMedia.js'
import { MUSCLE_GROUPS } from '../constants.js'
import '../styles/screens/progress.css'

// ── الأرقام ───────────────────────────────────────────────────
//
// The charts that used to sit on an orphaned stats page, back where
// progress lives: the week's tonnage as the one big number (this week's
// once there is any; before that, the last week that had some — never
// a bold «0» on a Sunday morning), the last
// twelve weeks of volume and of sessions drawn to scale, the totals,
// the heaviest weight on each main lift (gold — it is the best weight),
// and where the sets went this month.
//
// Weeks start on Sunday and are counted in training days (the day
// turns at 03:00, like everywhere else in the app).

const WEEKS = 12
const DAY = 86400000
// «13.6» · «106» · «0» — one decimal under 100 tons, never a trailing «.0».
const tons = (kg) => {
  const t = kg / 1000
  return String(+t.toFixed(t >= 100 ? 0 : 1))
}
const repsWord = (n) => (n >= 3 && n <= 10 ? 'تكرارات' : 'تكرار')
const sessionsWord = (n) => (n === 1 ? 'جلسة' : n === 2 ? 'جلستين' : n >= 3 && n <= 10 ? 'جلسات' : 'جلسة')
const dm = (ms) => { const d = new Date(ms); return `${d.getDate()}/${d.getMonth() + 1}` }
/** A number and its unit that never break apart: «1.9 طن», «3 جلسات». */
const Qty = ({ n, u }) => <span className="nb-nw"><Num>{n}</Num> {u}</span>
const sessionsQty = (n) => (n === 2 ? 'جلستين' : <Qty n={n} u={sessionsWord(n)} />)
const weeksAgo = (n) => (n === 2 ? 'قبل أسبوعين' : n <= 10 ? <>قبل <Qty n={n} u="أسابيع" /></> : <>قبل <Qty n={n} u="أسبوع" /></>)

/**
 * What the big number says. This week's tonnage once there is some;
 * otherwise the latest week in the window that had some, named as such,
 * with this week's state underneath; with nothing lifted in twelve weeks,
 * the total since the first session.
 */
function heroOf(weeks, totalVol, sessionCount) {
  const n = weeks.length
  const now = weeks[n - 1]
  const prev = weeks[n - 2]
  const thisWeek = now.sessions > 0
    ? <>{sessionsQty(now.sessions)} هذا الأسبوع</>
    : 'ما تمرّنت هذا الأسبوع للحين'

  if (now.volume > 0) {
    return {
      eyebrow: 'حجم هذا الأسبوع', value: tons(now.volume), unit: 'طن',
      sub: <>{thisWeek}{prev.volume > 0 && <> · الأسبوع اللي قبله <Qty n={tons(prev.volume)} u="طن" /></>}</>,
    }
  }
  let i = n - 2
  while (i >= 0 && !(weeks[i].volume > 0)) i--
  if (i === n - 2) {
    return { eyebrow: 'حجم الأسبوع اللي فات', value: tons(prev.volume), unit: 'طن', sub: thisWeek }
  }
  if (i >= 0) {
    return {
      eyebrow: 'آخر أسبوع رفعت فيه أوزان', value: tons(weeks[i].volume), unit: 'طن',
      sub: <>{weeksAgo(n - 1 - i)} · {thisWeek}</>,
    }
  }
  if (totalVol > 0) {
    return { eyebrow: 'رفعت من أول جلسة', value: tons(totalVol), unit: 'طن', sub: thisWeek }
  }
  return { eyebrow: 'جلساتك من البداية', value: sessionCount, unit: sessionsWord(sessionCount), sub: thisWeek }
}

function weekly(sessions) {
  const today = dayStart(todayKey())
  const thisWeek = today - new Date(today).getDay() * DAY
  const first = thisWeek - (WEEKS - 1) * 7 * DAY
  const weeks = Array.from({ length: WEEKS }, (_, i) => ({
    start: first + i * 7 * DAY, volume: 0, sessions: 0, days: new Set(),
  }))
  for (const s of sessions) {
    const k = dayKey(s.date)
    const idx = Math.floor(Math.round((dayStart(k) - first) / DAY) / 7)
    if (idx < 0 || idx >= WEEKS) continue
    weeks[idx].volume += sessionVolume(s)
    weeks[idx].sessions++
    weeks[idx].days.add(k)
  }
  return weeks
}

export default function StatsPage({ sessions = [] }) {
  const data = useMemo(() => {
    if (!sessions.length) return null
    const weeks = weekly(sessions)
    const now = weeks[weeks.length - 1]
    const prev = weeks[weeks.length - 2]

    // Average over the full weeks since the first one with a session —
    // not over empty weeks before the user started.
    const full = weeks.slice(0, -1)
    const startAt = full.findIndex(w => w.sessions > 0)
    const span = startAt === -1 ? [] : full.slice(startAt)
    const avg = span.length ? span.reduce((n, w) => n + w.sessions, 0) / span.length : 0

    let totalVol = 0, totalSets = 0, durN = 0, durSum = 0
    const lifts = {}
    const muscles = {}
    const monthAgo = Date.now() - 30 * DAY
    for (const s of sessions) {
      totalVol += sessionVolume(s)
      if (s.duration) { durN++; durSum += s.duration }
      const recent = new Date(s.date).getTime() > monthAgo
      for (const ex of s.exercises || []) {
        const done = (ex.sets || []).filter(setCounts)
        totalSets += done.length
        if (recent && done.length) muscles[ex.muscle] = (muscles[ex.muscle] || 0) + done.length
        if (!done.length) continue
        const L = lifts[ex.name] || (lifts[ex.name] = { name: ex.name, count: 0, best: 0, reps: 0 })
        L.count++
        for (const ss of done) {
          const w = parseFloat(ss.weight) || 0
          const r = parseInt(ss.reps) || 0
          if (w > L.best || (w === L.best && r > L.reps)) { L.best = w; L.reps = r }
        }
      }
    }
    const top = Object.values(lifts).filter(l => l.best > 0).sort((a, b) => b.count - a.count).slice(0, 5)
    const muscleTotal = Object.values(muscles).reduce((a, b) => a + b, 0)
    const muscleRows = Object.entries(muscles).sort((a, b) => b[1] - a[1]).slice(0, 7)

    return {
      weeks, now, prev, avg, top, muscleRows, muscleTotal,
      totalVol, totalSets, avgDur: durN ? Math.round(durSum / durN) : 0,
    }
  }, [sessions])

  if (!data) {
    return (
      <EmptyState icon={ChartLineUp} title="أرقامك تبدأ من أول جلسة">
        سجّل أول جلسة، وهنا تشوف حجمك كل أسبوع وكم مرة تمرّنت.
      </EmptyState>
    )
  }

  const { weeks, now } = data
  const label = (w, i) => (i === weeks.length - 1 ? 'هذا الأسبوع' : <Num>{dm(w.start)}</Num>)
  const hero = heroOf(weeks, data.totalVol, sessions.length)

  return (
    <div className="nb" data-testid="numbers">
      {/* ── The one big number: the week's tonnage ── */}
      <section className="nb-hero">
        <span className="k-eyebrow">{hero.eyebrow}</span>
        <div className="nb-hero-n">
          <Num className="nb-big">{hero.value}</Num>
          <span className="nb-unit">{hero.unit}</span>
        </div>
        <p className="nb-hero-sub">{hero.sub}</p>
      </section>

      <Chapter eyebrow={<>آخر <Num>{WEEKS}</Num> أسبوع</>} title="الحجم الأسبوعي">
        <div className="nb-card">
          <BarChart
            data={weeks.map((w, i) => ({ value: w.volume, label: label(w, i), aria: i === weeks.length - 1 ? 'هذا الأسبوع' : `أسبوع ${dm(w.start)}` }))}
            format={(v) => tons(v)}
            unit="طن"
            height={132}
            ariaLabel={`الحجم الأسبوعي لآخر ${WEEKS} أسبوع، بالطن. هذا الأسبوع ${tons(now.volume)} طن.`}
          />
        </div>
      </Chapter>

      <Chapter eyebrow="كم مرة تمرّنت" title="الجلسات بالأسبوع">
        <div className="nb-card">
          <BarChart
            data={weeks.map((w, i) => ({ value: w.sessions, label: label(w, i), aria: i === weeks.length - 1 ? 'هذا الأسبوع' : `أسبوع ${dm(w.start)}` }))}
            showValues="all"
            height={96}
            format={(v) => Math.round(v)}
            ariaLabel={`عدد الجلسات في كل أسبوع لآخر ${WEEKS} أسبوع. هذا الأسبوع ${now.sessions}.`}
          />
          {data.avg > 0 && (
            <p className="nb-note">متوسطك <Qty n={data.avg.toFixed(1)} u="جلسة" /> بالأسبوع</p>
          )}
        </div>
      </Chapter>

      <Chapter eyebrow="من أول جلسة" title="المجموع">
        <div className="nb-totals">
          <Stat n={sessions.length} label="جلسة" />
          <Stat n={data.totalSets.toLocaleString('en-US')} label="مجموعة مكتملة" />
          <Stat n={tons(data.totalVol)} label="طن رفعتها" />
          <Stat n={data.avgDur || '—'} label="دقيقة متوسط الجلسة" />
        </div>
      </Chapter>

      {data.top.length > 0 && (
        <Chapter eyebrow="تمارينك الأساسية" title="أعلى وزن">
          <div className="nb-list">
            {data.top.map(l => {
              const ar = arabicName(l.name)
              return (
                <div key={l.name} className="nb-lift">
                  <span className="nb-lift-name">
                    <span className="nb-lift-ar">{ar || <bdi dir="ltr">{l.name}</bdi>}</span>
                    {ar && <bdi dir="ltr" className="nb-lift-en">{l.name}</bdi>}
                  </span>
                  <span className="nb-lift-v">
                    <Weight kg={l.best} className="nb-best" />
                    {l.reps > 0 && <span className="nb-lift-reps"><Qty n={l.reps} u={repsWord(l.reps)} /></span>}
                  </span>
                </div>
              )
            })}
          </div>
        </Chapter>
      )}

      {data.muscleRows.length > 0 && (
        <Chapter eyebrow={<>آخر <Num>30</Num> يوم</>} title="وين راحت مجموعاتك">
          <div className="nb-card nb-muscles">
            {data.muscleRows.map(([m, c]) => {
              const pct = Math.round((c / data.muscleTotal) * 100)
              return (
                <div key={m} className="nb-m">
                  <div className="nb-m-top">
                    <span>{MUSCLE_GROUPS[m]?.label || m}</span>
                    <span className="nb-m-v"><Qty n={c} u="مجموعة" /> · <Num>{pct}%</Num></span>
                  </div>
                  <div className="nb-m-track"><i style={{ transform: `scaleX(${pct / 100})` }} /></div>
                </div>
              )
            })}
          </div>
        </Chapter>
      )}
    </div>
  )
}

function Stat({ n, label }) {
  return (
    <div className="nb-stat">
      <Num className="nb-stat-n">{n}</Num>
      <span className="nb-stat-l">{label}</span>
    </div>
  )
}
