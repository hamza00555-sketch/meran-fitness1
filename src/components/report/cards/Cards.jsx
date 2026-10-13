// ── The report's nine cards ───────────────────────────────────
// The approved cards (plans/report.html, v2), each a small question, one
// sentence that answers it in the big type, and one drawing with a grey
// line under it on how to read it. The same component plays in the
// full-screen story and sits stacked on the summary page; `story` only
// decides what may loop and whether a moment makes a sound.
//
//   cover   — how many sessions he came to, on a ring of the planned ones
//   cal     — when he trained, each day lit by how heavy it was; the streak
//   jump    — the month's biggest new weight, its lift week by week
//   lifts   — the other lifts: how many kilos each went up
//   muscles — sets per muscle per week against the 10–20 band
//   ba      — the month's first and last progress photo
//   goal    — the month's goal: reached or how far off
//   next    — up to three things for next month, its goal, and the button
//   share   — the month's poster, ready
//
// `playing` runs a card's entrance (and, in the story, replays it each
// time the card comes round: the story remounts the card).

import { useEffect, useRef, useState } from 'react'
import RollNumber from '../../RollNumber.jsx'
import { Flame, Ticket } from '../../streak/StreakIcons.jsx'
import { ArrowUp, ArrowDown, Plus as PlusIcon, Target, Check, LockSimple, ArrowsLeftRight, ShareFat, PencilSimple } from '../../kit/icons.js'
import { Num } from '../../kit/index.jsx'
import { Bidi } from '../parts.jsx'
import { CountTo, Dust, XMark, Plus } from './bits.jsx'
import { LineChart, StepChart } from './charts.jsx'
import { arabicName } from '../../../exerciseMedia.js'
import { dayKey } from '../../../day.js'
import { unitAr, countAr, fmtDayAr } from '../../../streak.js'
import {
  attendanceLine, deloadLine, calendarLine, musclesLine, nextCopy, countWord,
  monthName, monthLabel, nextMonth, lastDayOf, kgText,
} from '../../../monthReport.js'
import {
  ringArcs, liftRows, liftsLine, liftScale, muscleScale, jumpChart, goalSteps, calendarPad,
} from '../../../reportStory.js'
import { dayDiff } from '../../../recovery.js'
import { play as playSound } from '../../../sound.js'
import { haptic } from '../../../haptics.js'
import { reducedMotion } from '../../../motion.js'
import { drawMonthPoster } from '../../../reportPoster.js'

const ShareRtl = (props) => <ShareFat {...props} mirrored />
const over = (month, today) => String(today || '').slice(0, 7) > month
const shortDay = (iso) => fmtDayAr(iso, { weekday: false })
const nameOf = (ex, mapping) => arabicName(ex, mapping) || ex

function Card({ k, playing, label, children, extra = '', style, cardRef }) {
  return (
    <section ref={cardRef} id={`rp-card-${k}`} data-card={k}
      className={`rs-card c-${k}${playing ? ' play' : ''}${extra ? ` ${extra}` : ''}`}
      aria-label={label} style={style}>
      {children}
    </section>
  )
}

/** Run `fn` once, `ms` after the card starts playing. */
function useAt(playing, ms, fn) {
  const f = useRef(fn)
  f.current = fn
  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => f.current?.(), ms)
    return () => clearTimeout(t)
  }, [playing, ms])
}

// ══ 1 · the cover ═════════════════════════════════════════════

export function CoverCard({ report, playing, story }) {
  const a = report.attendance
  const arcs = ringArcs(a.slots)
  const missed = a.missed + a.tickets
  const label = `${a.attended} ${unitAr(a.attended, 'session')} حضرتها${a.planned ? ` من ${a.planned} في خطتك` : ''}`
  const read = !a.planned
    ? 'كل شرطة في الدائرة جلسة حضرتها.'
    : `كل شرطة في الدائرة جلسة في خطتك. المضيئة حضرتها${report.deload ? '، والزرقا جلسات التخفيف' : ''}${missed ? '، والباهتة فاتتك' : ''}${a.ahead ? '، والمنقّطة باقية' : ''}.`
  return (
    <Card k="cover" playing={playing} label="غلاف الشهر" extra="rp-cover">
      <div className="beam" aria-hidden="true" />
      <div className="lamp" aria-hidden="true" />
      <div className="haze" aria-hidden="true" />
      <span className="bgword" aria-hidden="true">{monthName(report.month)}</span>
      <Dust moving={story && playing} />
      {/* Where focus lands when another month opens in place. */}
      <p className="k-eb a rp-eyebrow rp-cover-title" style={{ '--d': '100ms' }} tabIndex={-1}>
        تقرير <Bidi text={report.monthLabel} />
      </p>
      <div className="ring" role="img" aria-label={label}>
        <svg viewBox="0 0 100 100" className="rp-ring" aria-hidden="true">
          {arcs.map((s, i) => (
            <path key={s.date || i} d={s.d} style={{ '--i': s.i }}
              className={`sg rp-arc is-${s.state}${s.deload ? ' is-deload' : ''} ${s.state === 'done' ? (s.deload ? 'dl' : 'on') : s.state === 'ahead' ? 'ahead' : 'off'}`} />
          ))}
        </svg>
        <div className="mid">
          <b className="big metal rp-hero" style={{ '--sd': `${430 + a.attended * 70 + 60}ms` }}>
            <CountTo to={a.attended} dur={Math.max(300, a.attended * 70)} delay={430} ease="lin" run={playing} />
          </b>
          <span className="a rp-hero-unit" style={{ '--d': '1500ms' }}>{unitAr(a.attended, 'session')} حضرتها</span>
        </div>
      </div>
      <p className="k-h a rp-cover-line" style={{ '--d': '1800ms' }}><Bidi text={attendanceLine(a)} /></p>
      {report.deload && (
        <p className="k-dl a rp-cover-note is-deload" style={{ '--d': '2100ms' }}>
          <i aria-hidden="true" /><Bidi text={deloadLine(report.deload.ranges, report.month)} />
        </p>
      )}
      <p className="k-read a" style={{ '--d': '2300ms' }}>{read}</p>
    </Card>
  )
}

// ══ 2 · when did you train ════════════════════════════════════

const WEEK = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']
const KIND = { trained: 'تمرّنت', rest: 'راحة', paid: 'تذكرة بدل يوم فاتك', miss: 'فاتك', ahead: 'لسا ما جا', none: 'قبل ما تبدأ' }
const LIGHT = ['', 'خفيف جداً', 'خفيف', 'متوسط', 'ثقيل', 'ثقيل جداً']
const cellLabel = (day) => [fmtDayAr(day.date), KIND[day.kind] || '',
  day.kind === 'trained' && day.level ? LIGHT[day.level] : '', day.deload ? 'تخفيف' : ''].filter(Boolean).join(' · ')

function cellClass(day) {
  if (day.kind === 'trained') return day.level ? `t w c${day.level}` : day.deload ? 't dl' : 't w c3'
  if (day.kind === 'miss') return 't x'
  if (day.kind === 'paid') return 't p'
  if (day.kind === 'ahead') return `t ah${day.planned ? ' pl' : ''}`
  if (day.kind === 'none') return 't n'
  return 't r'
}

export function HeatGrid({ report, mini = false }) {
  const cal = report.consistency.calendar
  const pad = calendarPad(report.month)
  return (
    <div className="hm rp-cal" role="list" aria-label={`أيام ${monthLabel(report.month)}`}>
      {!mini && WEEK.map(w => <span key={w} className="wd" aria-hidden="true">{w}</span>)}
      {Array.from({ length: pad }, (_, i) => <span key={`pad${i}`} aria-hidden="true" />)}
      {cal.map((day, i) => (
        <span key={day.date} role="listitem" aria-label={cellLabel(day)} title={cellLabel(day)}
          data-date={day.date} data-kind={day.kind} data-level={day.kind === 'trained' && day.level ? day.level : undefined}
          className={`${cellClass(day)} rp-cal-cell k-${day.kind}${day.deload ? ' is-deload' : ''}`} style={{ '--i': i }}>
          {day.kind === 'miss' ? <XMark /> : day.kind === 'paid' ? <Ticket size={12} /> : <Num>{Number(day.date.slice(8))}</Num>}
        </span>
      ))}
    </div>
  )
}

export function CalendarCard({ report, playing, ctx }) {
  const c = report.consistency
  const done = over(report.month, ctx.today)
  const streak = done ? c.endStreak : (ctx.liveStreak ?? c.endStreak)
  const hasDeload = c.calendar.some(d => d.deload)
  const lead = calendarLine(c.calendar) || 'ما فيه أيام في خطتك هالشهر.'
  return (
    <Card k="cal" playing={playing} label="متى تمرّنت؟">
      <p className="k-eb a">متى تمرّنت؟</p>
      <p className="k-h a" style={{ '--d': '80ms' }}><Bidi text={lead} /></p>
      <div className="calblock">
        <HeatGrid report={report} />
        <div className="hm-key rp-key a" style={{ '--d': '1700ms' }} aria-hidden="true">
          <span>أخف</span>
          {[0.2, 0.36, 0.55, 0.76, 0.96].map(x => <i key={x} style={{ '--a': x }} />)}
          <span>أثقل</span>
          <span className="gap" />
          <span className="kx"><XMark /></span><span>فاتك</span>
          {c.paidRests > 0 && <><span className="gap" /><span className="kp"><Ticket size={10} /></span><span>تذكرة بدل يوم فاتك</span></>}
          {hasDeload && <><span className="gap" /><span className="kd" /><span>تخفيف</span></>}
        </div>
        <p className="k-read a" style={{ '--d': '1900ms' }}>كل مربع يوم. المضيء يوم تمرّنت فيه، وكل ما نوّر أكثر رفعت فيه كيلوات أكثر.</p>
        {c.paidRests > 0 && (
          <p className="k-tk a rp-tickets" style={{ '--d': '2000ms' }}>
            <Ticket size={16} />
            <span><Bidi text={c.paidRests === 1
              ? 'انصرفت تذكرة وحدة هالشهر بدل يوم فاتك، والستريك ما انكسر.'
              : `انصرفت ${countAr(c.paidRests, 'ticket')} هالشهر بدل أيام فاتتك، والستريك ما انكسر.`} /></span>
          </p>
        )}
      </div>
      {Number.isFinite(streak) && (
        <div className="streak a rp-streak" style={{ '--d': '2100ms' }} aria-label={`الستريك ${streak} ${unitAr(streak, 'day')}`}>
          <Flame size={40} filled={streak > 0} />
          <b className={`big${streak === 0 ? ' zero' : ''}`}><CountTo to={streak} dur={600} delay={2100} run={playing} /></b>
          <span>{unitAr(streak, 'day')} ستريك<br />{done ? `آخر ${monthName(report.month)}` : 'لين اليوم'}</span>
        </div>
      )}
    </Card>
  )
}

// ══ 3 · the biggest jump ══════════════════════════════════════

export function JumpCard({ report, playing, story, ctx }) {
  const j = report.jump
  const chart = jumpChart(j, report.month)
  const ar = arabicName(j.exercise, ctx.mapping)
  const name = ar || j.exercise
  const confetti = useRef(null)
  const root = useRef(null)
  const [rolled, setRolled] = useState(false)
  const rolling = playing && !rolled && !reducedMotion()
  // The moment the line reaches the new weight's dot: wipe starts at
  // 0.3 s and crosses the plot in 1.8 s.
  const hit = Math.round((0.3 + (chart?.pr?.t ?? 1) * 1.8) * 1000)
  const prior = kgText(j.prevBest)
  const lead = j.firstTime
    ? `بدأته على ${prior} هالشهر، ووصلت ${kgText(j.weight)}${j.date ? ` يوم ${shortDay(j.date)}` : ''}.`
    : `أول مرة تتعدّى ${prior}.${j.date ? ` رفعته يوم ${shortDay(j.date)}.` : ''}`
  const dl = (chart?.deloads?.length || 0) > 0

  useAt(playing, hit, () => {
    if (story) { playSound('new-weight'); haptic('pr') }
    if (reducedMotion() || !confetti.current) return
    import('canvas-confetti').then((m) => {
      const cv = confetti.current
      if (!cv || !cv.isConnected) return
      try {
        const shoot = m.default.create(cv, { resize: true, useWorker: false, disableForReducedMotion: true })
        const dot = root.current?.querySelector('.pt.prd')
        const cr = cv.getBoundingClientRect(), r = dot?.getBoundingClientRect()
        const origin = r && cr.width ? { x: (r.left + r.width / 2 - cr.left) / cr.width, y: (r.top + r.height / 2 - cr.top) / cr.height } : { x: 0.5, y: 0.5 }
        shoot({ particleCount: 90, spread: 80, startVelocity: 30, gravity: 1, ticks: 190, scalar: 0.75, origin, disableForReducedMotion: true,
          colors: ['#FBBF24', '#FDE68A', '#D99A0B', '#F4F6F8'] })
      } catch {}
    }, () => {})
  })

  return (
    <Card k="jump" playing={playing} label="أكبر قفزة" cardRef={root} style={{ '--hit': `${hit}ms` }}>
      <div className="spot" aria-hidden="true" />
      <canvas ref={confetti} className="confetti" aria-hidden="true" />
      <p className="k-eb a">أكبر قفزة هالشهر · وزن جديد</p>
      <p className="nm a" style={{ '--d': '100ms' }}>{ar ? name : <Num>{name}</Num>}</p>
      <div className="hero rp-best">
        {/* The roll's moving strips cannot be painted through a text clip,
            so the number rolls in plain gold and turns to lit metal as it
            lands (the sweep crosses it then). */}
        <b className={`big gold numroll${rolling ? ' rolling' : ' metal'}`} aria-label={`${kgText(j.weight)} كجم`}>
          {rolling
            ? <RollNumber from={prior} to={kgText(j.weight)} delay={Math.max(0, hit - 380)} stagger={60} onDone={() => setRolled(true)} />
            : kgText(j.weight)}
        </b>
        <span className="a" style={{ '--d': '300ms' }}>كجم</span>
      </div>
      <p className="k-h sm a" style={{ '--d': `${hit + 250}ms` }}><Bidi text={lead} /></p>
      <p className="k-t a" style={{ '--d': '200ms' }}>أثقل وزن رفعته في {ar ? name : <Num>{name}</Num>}، كل أسبوع</p>
      <LineChart chart={chart}
        label={`أثقل وزن في ${name} كل أسبوع: قبل ${monthName(report.month)} ${prior}، ووصل ${kgText(j.weight)}${j.date ? ` يوم ${shortDay(j.date)}` : ''}`}
        refLabel={j.firstTime ? 'أول وزن بدأت فيه' : `أثقل وزن قبل ${monthName(report.month)}`}
        prTag={{ v: kgText(j.weight), when: j.date ? shortDay(j.date) : '' }} />
      <p className="k-read a" style={{ '--d': '2300ms' }}>
        <Bidi text={`الخط يصير ذهبي لما يطلع فوق ${prior}، ${j.firstTime ? 'أول وزن بدأت فيه' : `أثقل وزن لك قبل ${monthName(report.month)}`}. يعني: وزن جديد.${dl ? ' والنقطة الزرقا أسبوع التخفيف، ما تنحسب.' : ''}`} />
      </p>
      {ctx.onShare && (
        <button type="button" className="qbtn a" style={{ '--d': '2500ms' }} onClick={() => ctx.onShare('pr')} disabled={ctx.sharing}>
          <ShareRtl weight="bold" aria-hidden="true" />{ctx.sharing === 'pr' ? 'نجهّز الصورة…' : 'شارك هذي'}
        </button>
      )}
    </Card>
  )
}

// ══ 4 · did you get stronger ══════════════════════════════════

export function LiftsCard({ report, playing, ctx }) {
  const rows = liftRows(report)
  const scale = liftScale(rows)
  const at = (v) => `${(Math.min(v, scale.max) / scale.max) * 100}%`
  const hasDeload = (report.volume?.deloadSessions || 0) > 0
  const startedHere = rows.some(r => r.up && r.firstTime)
  return (
    <Card k="lifts" playing={playing} label="صرت أقوى؟">
      <p className="k-eb a">صرت أقوى؟</p>
      <p className="k-h a" style={{ '--d': '80ms' }}><Bidi text={liftsLine(report)} /></p>
      <div className="centerblock">
        <p className="k-t a" style={{ '--d': '160ms' }}>كم كيلو زاد أثقل وزن لك، عن قبل {monthName(report.month)}</p>
        <div className="rbc" role="img"
          aria-label={rows.map(r => `${nameOf(r.exercise, ctx.mapping)} ${r.up ? `زاد ${kgText(r.gain)} كجم` : 'ما زاد'}`).join('، ')}>
          <div className="bh" aria-hidden="true">
            {scale.ticks.map((t, i) => (
              <span key={t} className={i === 0 ? 's' : undefined} style={{ right: at(t) }}>
                {i === 0 ? '0' : `+${t}${i === scale.ticks.length - 1 ? ' كجم' : ''}`}
              </span>
            ))}
          </div>
          <div className="bb">
            <div className="bg" aria-hidden="true">
              {scale.ticks.map((t, i) => <i key={t} className={i === 0 ? 'z' : undefined} style={{ right: at(t) }} />)}
            </div>
            {rows.map((r, i) => {
              const nm = nameOf(r.exercise, ctx.mapping)
              return (
                <div key={r.lift} className={`brow lift-row${r.up ? ' is-up' : ''}`} style={{ '--i': i }}>
                  <p className="nm">{nm}
                    <small>{r.up
                      ? <>{r.firstTime ? 'بدأته على' : 'كان'} <Num>{kgText(r.before)}</Num>، صار <Num>{kgText(r.top)}</Num></>
                      : <>واقف على <Num>{kgText(Math.max(r.before, r.top))}</Num></>}</small>
                  </p>
                  <div className="btrack" aria-hidden="true">
                    {r.up ? (
                      <>
                        <i className="bfill gold" style={{ '--w': at(r.gain) }} />
                        <b className="bval rp-gain" style={{ '--w': at(r.gain) }}><Plus kg={r.gain} /></b>
                      </>
                    ) : (
                      <>
                        <i className="bzero" />
                        <span className="bval flat" style={{ '--w': '0%' }}>ما زاد</span>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <p className="k-read a" style={{ '--d': '1800ms' }}>
          العمود الذهبي يعني وزن جديد، وطوله كم كيلو زاد.
          {startedHere && ' والتمرين اللي بدأته هالشهر: عن أول وزن بدأت فيه.'}
          {hasDeload && ' جلسات التخفيف ما تنحسب هنا.'}
        </p>
      </div>
    </Card>
  )
}

// ══ 5 · where did the work go ═════════════════════════════════

export function MusclesCard({ report, playing }) {
  const rows = report.muscles || []
  const max = muscleScale(rows)
  const at = (v) => `${(Math.min(v, max) / max) * 100}%`
  const lead = musclesLine(rows) || 'شغلك توزّع على عضلاتك.'
  return (
    <Card k="muscles" playing={playing} label="وين راح شغلك؟">
      <p className="k-eb a">وين راح شغلك؟</p>
      <p className="k-h a" style={{ '--d': '80ms' }}>{lead}</p>
      <div className="centerblock">
        <p className="k-t a" style={{ '--d': '160ms' }}>كم مجموعة أخذت كل عضلة بالأسبوع</p>
        <div className="rbc rp-sets">
          <div className="bh" aria-hidden="true" style={{ height: '5.4cqw' }}>
            <span className="s" style={{ right: 0 }}>0</span>
          </div>
          <div className="bb">
            <div className="bg" aria-hidden="true">
              <i className="z" style={{ right: 0 }} />
            </div>
            {rows.map((m, i) => {
              const low = m.status === 'low'
              const n = m.shown ?? Math.round(m.perWeek)
              const w = at(Math.max(n, 0.4))
              // A part of a bigger group that fell short is named under it
              // («السمانة أقل من اللازم»); a group of one says it on the bar.
              const part = low && (m.areas || []).length > 1 ? (m.lowAreas || [])[0] : null
              const hasBand = m.min > 0 && m.max > 0
              return (
                <div key={m.key} className={`brow rp-sets-row${low ? ' is-low' : ''}`} style={{ '--i': i }}
                  role="img" aria-label={`${m.label}: ${n < 1 ? 'أقل من مجموعة' : countWord(n, 'set')} بالأسبوع${hasBand ? `، والمناسب من ${m.min} إلى ${m.max}` : ''}${low ? `، ${part ? part.label + ' ' : ''}أقل من اللازم` : ''}`}>
                  <p className="nm rp-sets-l">{m.label}{part && <small>{part.label} أقل من اللازم</small>}</p>
                  <div className="btrack" aria-hidden="true">
                    {hasBand && <span className="band rp-sets-band" style={{ right: at(m.min), width: `calc(${at(m.max)} - ${at(m.min)})` }} />}
                    <i className={`bfill${low ? ' hi' : ''}`} style={{ '--w': w }} />
                    <b className="bval" style={{ '--w': w }}><Num>{n}</Num></b>
                    {low && !part && <span className="bnote rp-sets-note" style={{ right: `calc(${w} + 7.6cqw)` }}>أقل من اللازم</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <p className="k-read a" style={{ '--d': '1800ms' }}>
          المنطقة الفاتحة: المدى اللي تكبر فيه كل عضلة. والتمرين اللي يشغّلها من بعيد ينحسب لها نص مجموعة، مثل باني الخطط.
        </p>
      </div>
    </Card>
  )
}

// ══ 6 · before and after ══════════════════════════════════════

const BA_KEYS = [[0, 0], [700, 0], [1900, 100], [2500, 100], [3300, 50]]
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function BeforeAfterCard({ report, playing, ctx }) {
  const { before, after } = ctx.pair
  const [p, setP] = useState(50)
  const box = useRef(null)
  const dragged = useRef(false)
  const b = shortDay(dayKey(before.date)), a = shortDay(dayKey(after.date))

  // The line sweeps from «قبل» to «بعد» and back to the middle, once;
  // after that it is his to drag.
  useEffect(() => {
    if (!playing || reducedMotion()) return
    dragged.current = false
    let raf = 0, t0 = null
    const step = (now) => {
      if (dragged.current) return
      if (t0 === null) t0 = now
      const t = now - t0
      let v = 50
      for (let i = 1; i < BA_KEYS.length; i++) {
        if (t <= BA_KEYS[i][0]) {
          const [ta, va] = BA_KEYS[i - 1], [tb, vb] = BA_KEYS[i]
          v = va + (vb - va) * easeIO(Math.max(0, (t - ta) / (tb - ta || 1)))
          break
        }
      }
      setP(v)
      if (t < BA_KEYS[BA_KEYS.length - 1][0]) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const at = (e) => {
    const r = box.current.getBoundingClientRect()
    return Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100))
  }
  const onDown = (e) => {
    dragged.current = true
    e.stopPropagation()
    try { box.current.setPointerCapture(e.pointerId) } catch {}
    setP(at(e))
  }
  const onMove = (e) => { if (dragged.current && e.buttons) setP(at(e)) }
  const onKey = (e) => {
    if (e.key === 'ArrowLeft') { dragged.current = true; setP(v => Math.max(0, v - 5)); e.preventDefault(); e.stopPropagation() }
    if (e.key === 'ArrowRight') { dragged.current = true; setP(v => Math.min(100, v + 5)); e.preventDefault(); e.stopPropagation() }
  }

  return (
    <Card k="ba" playing={playing} label="قبل وبعد">
      <p className="k-eb a">قبل وبعد</p>
      <p className="k-h a" style={{ '--d': '80ms' }}>صورتك أول {monthName(report.month)} وآخره.</p>
      <div className="ba" ref={box} style={{ '--p': `${p.toFixed(2)}%` }}
        onPointerDown={onDown} onPointerMove={onMove} onClick={e => e.stopPropagation()}>
        <img className="ba-a" src={after.src} alt={`بعد: ${a}`} draggable="false" />
        <img className="ba-b" src={before.src} alt={`قبل: ${b}`} draggable="false" />
        <span className="ba-t r">قبل · <Bidi text={b} /></span>
        <span className="ba-t l">بعد · <Bidi text={a} /></span>
        <span className="ba-h" role="slider" tabIndex={0} aria-label="الخط بين قبل وبعد"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p)} onKeyDown={onKey}>
          <i><ArrowsLeftRight size={20} weight="bold" aria-hidden="true" /></i>
        </span>
      </div>
      <p className="k-read a" style={{ '--d': '600ms' }}>اسحب الخط يمين ويسار وشوف الفرق.</p>
      <p className="k-lock a" style={{ '--d': '700ms' }}>
        <LockSimple weight="bold" aria-hidden="true" />الصور لك بس. ما تطلع في صورة المشاركة.
      </p>
    </Card>
  )
}

// ══ 7 · the month's goal ══════════════════════════════════════

const daysBefore = (n) => (n === 1 ? 'بيوم' : n === 2 ? 'بيومين' : `بـ${countAr(n, 'day')}`)

export function GoalCard({ report, playing, story, ctx }) {
  const g = report.goal
  const done = over(report.month, ctx.today)
  const mName = monthName(report.month)
  const lift = g.kind === 'lift'

  useAt(playing && g.reached, 1650, () => { if (story) { playSound('medal'); haptic('medal') } })

  let title, sub, line
  if (lift) {
    const kg = `${kgText(g.target)} كجم`
    sub = `هدفك كان ${kg} في ${g.name}.`
    if (g.reached) { title = 'حققته'; line = `رفعت ${kg} يوم ${shortDay(g.reachedOn)}.` }
    else if (done) { title = 'ما وصلته'; line = g.best > 0 ? `أثقل وزن رفعته ${kgText(g.best)}، ناقصك ${kgText(g.left)} كجم.` : `ما رفعته هالشهر، ناقصك ${kg}.` }
    else { title = 'باقي لك'; line = `أثقل وزن رفعته ${kgText(g.best)}، باقي لك ${kgText(g.left)} كجم.` }
  } else {
    sub = `هدفك كان ${countAr(g.target, 'session')}.`
    if (g.reached) {
      title = 'حققته'
      const early = dayDiff(g.reachedOn, lastDayOf(report.month))
      line = `وصلت هدفك يوم ${shortDay(g.reachedOn)}${early > 0 ? `، قبل آخر الشهر ${daysBefore(early)}` : ''}.`
    } else if (done) { title = 'ما وصلته'; line = `حضرت ${g.done} من ${g.target}، ناقصك ${countAr(g.left, 'session')}.` }
    else { title = 'باقي لك'; line = `حضرت ${g.done} من ${g.target}، باقي لك ${countAr(g.left, 'session')}.` }
  }

  const steps = lift ? null : goalSteps(report.consistency.calendar, g.target, report.month)
  const liftChart = lift && g.weekly ? jumpChart({ weekly: g.weekly, prevBest: g.target, weight: g.best, date: g.reachedOn }, report.month) : null
  if (liftChart && !g.reached) liftChart.pr = null

  return (
    <Card k="goal" playing={playing} label={`هدف ${mName}`} style={{ '--glint': `${(steps?.hit ? 0.5 + steps.hit.t * 1.6 : 2) + 0.1}s` }}>
      <p className="k-eb a">هدف {mName}</p>
      <div className="medalbox">
        <div className={`medal${g.reached ? '' : ' hollow'}`} aria-hidden="true">
          <div className="disc"><div className="face">{g.reached ? <Check size={40} weight="bold" /> : <Target size={36} weight="bold" />}</div><span className="glint" /></div>
        </div>
        <p className="a rp-goal-head" style={{ '--d': '900ms' }}><b>{title}</b><Bidi text={sub} /></p>
      </div>
      <p className="k-h sm a rp-goal-line" style={{ '--d': '1100ms' }}><Bidi text={line} /></p>
      <div className="centerblock">
        <p className="k-t a" style={{ '--d': '300ms' }}>{lift ? <>أثقل وزن في {g.name}، كل أسبوع</> : <>جلساتك على مدار {mName}</>}</p>
        {steps && (
          <StepChart steps={steps} goalLabel={`هدفك: ${g.target} ${unitAr(g.target, 'session')}`}
            label={`جلساتك تزيد على مدار ${mName}${steps.hit ? `، ووصلت هدفك ${g.target} يوم ${steps.hit.day}` : `، ${g.done} من ${g.target}`}`} />
        )}
        {liftChart && (
          <LineChart chart={liftChart} gold={false} height="50cqw" refLabel={`هدفك: ${kgText(g.target)} كجم`}
            label={`أثقل وزن في ${g.name} كل أسبوع، وهدفك ${kgText(g.target)}`} />
        )}
        <p className="k-read a" style={{ '--d': '2300ms' }}>
          {lift
            ? 'الخط أثقل وزن رفعته كل أسبوع، والخط الأفقي هدفك.'
            : `الخط يطلع درجة مع كل جلسة حضرتها${steps?.hit ? '. والنقطة يوم وصلت الهدف' : ''}.`}
        </p>
      </div>
    </Card>
  )
}

// ══ 8 · next month ════════════════════════════════════════════

const ICON = { raise: ArrowUp, sets: PlusIcon, lower: ArrowDown }

export const goalText = (goal) => goal?.kind === 'lift'
  ? `${kgText(goal.target)} كجم في ${goal.name || goal.exercise}`
  : `${goal?.target} ${unitAr(goal?.target, 'session')}`

export function NextCard({ report, playing, ctx }) {
  const items = report.next || []
  const nm = monthName(nextMonth(report.month))
  const n = ctx.next || {}
  const goal = n.goal || null
  const shown = goal || n.suggested || null
  const applied = n.applied || null
  const lead = items.length ? `${countWord(items.length, 'thing')} للشهر الجاي.` : 'كمّل زي ما أنت، ما فيه شي يحتاج يتغيّر.'
  const goalName = shown?.kind === 'lift' ? { ...shown, name: arabicName(shown.exercise, ctx.mapping) || shown.exercise } : shown
  return (
    <Card k="next" playing={playing} label={`خطة ${nm}`}>
      <p className="k-eb a">خطة {nm}</p>
      <p className="k-h a" style={{ '--d': '80ms' }}><Bidi text={lead} /></p>
      {items.length > 0 && (
        <ol className="todo centerblock rp-next">
          {items.map((item, i) => {
            const c = nextCopy(item, ctx.mapping)
            const Icon = ICON[item.kind] || PlusIcon
            return (
              <li key={`${item.kind}-${item.exercise || item.muscle}`} className="rp-next-item" style={{ '--i': i }} data-kind={item.kind}>
                <span className={`ic${item.kind === 'raise' ? ' g' : ''}`} aria-hidden="true"><Icon weight="bold" /></span>
                <div><b><Bidi text={c.title} /></b><span><Bidi text={c.reason} /></span></div>
              </li>
            )
          })}
        </ol>
      )}
      {n.editable && shown && (
        <div className="goal2 a" style={{ '--d': '850ms' }}>
          <span className="gi" aria-hidden="true"><Target weight="bold" /></span>
          <p className="rp-next-goal">
            <b><Bidi text={`هدف ${nm}: ${goalText(goalName)}`} /></b>
            {goal ? 'ثبّته. تقرير الشهر الجاي يقول لك حققته ولا لا.' : shown.kind === 'sessions' ? 'كل جلسات خطتك، ولا وحدة تفوتك.' : ''}
          </p>
          {n.onEditGoal && (
            <button type="button" className="tbtn" onClick={n.onEditGoal}>
              <PencilSimple size={14} weight="bold" aria-hidden="true" /> غيّره
            </button>
          )}
        </div>
      )}
      {n.editable && applied && (
        <div className="rs-undo a" role="status">
          <span><Bidi text={applied.text} /></span>
          <button type="button" onClick={n.onUndo}>تراجع</button>
        </div>
      )}
      {n.editable && !applied && items.length > 0 && n.appliedBefore && (
        <p className="fine a rp-applied" style={{ '--d': '1050ms' }}>طبّقتها على خطتك من قبل.</p>
      )}
      {n.editable && !applied && items.length > 0 && n.onApply && !n.appliedBefore && (
        <button type="button" className="gbtn a rp-apply" style={{ '--d': '1050ms' }} onClick={() => n.onApply(items)}>طبّقها على خطتي</button>
      )}
      {n.editable && !applied && !items.length && !goal && n.onSetGoal && shown && (
        <button type="button" className="gbtn a rp-apply" style={{ '--d': '1050ms' }} onClick={() => n.onSetGoal(shown)}>ثبّت هدف {nm}</button>
      )}
      {n.editable && !applied && !(items.length > 0 && n.appliedBefore) && (items.length > 0 || !goal) && (
        <p className="fine a" style={{ '--d': '1150ms' }}>
          {items.length ? 'خطتك ما تتغيّر إلا لما تضغط، وتقدر ترجع عنها.' : 'تقرير الشهر الجاي يقول لك حققته ولا لا.'}
        </p>
      )}
    </Card>
  )
}

// ══ 9 · share ═════════════════════════════════════════════════

export function SharePreview({ report, ctx }) {
  const ref = useRef(null)
  useEffect(() => {
    let alive = true
    const cv = ref.current
    if (!cv) return
    drawMonthPoster(cv, { report, profile: ctx.profile, mapping: ctx.mapping, liveStreak: ctx.liveStreak, today: ctx.today })
      .catch(() => {})
      .finally(() => { if (alive && cv) cv.dataset.ready = '1' })
    return () => { alive = false }
  }, [report, ctx.profile, ctx.mapping, ctx.liveStreak, ctx.today])
  return <canvas ref={ref} width="1080" height="1920" aria-label={`صورة ${report.monthLabel}`} role="img" />
}

export function ShareCard({ report, playing, ctx }) {
  return (
    <Card k="share" playing={playing} label="شارك شهرك">
      <p className="k-eb a">شارك شهرك</p>
      <div className="pwrap">
        <SharePreview report={report} ctx={ctx} />
        <span className="shine" aria-hidden="true" />
      </div>
      {ctx.onShare && (
        <button type="button" className="gbtn a rp-share" style={{ '--d': '900ms' }} onClick={() => ctx.onShare('month')} disabled={!!ctx.sharing}>
          <ShareRtl weight="bold" aria-hidden="true" />{ctx.sharing === 'month' ? 'نجهّز الصورة…' : 'شارك شهرك'}
        </button>
      )}
      {ctx.onShare && report.jump && (
        <button type="button" className="tbtn a" style={{ '--d': '1000ms' }} onClick={() => ctx.onShare('pr')} disabled={!!ctx.sharing}>
          أو شارك صورة الوزن الجديد بس
        </button>
      )}
    </Card>
  )
}

export const CARDS = {
  cover: CoverCard, cal: CalendarCard, jump: JumpCard, lifts: LiftsCard, muscles: MusclesCard,
  ba: BeforeAfterCard, goal: GoalCard, next: NextCard, share: ShareCard,
}
