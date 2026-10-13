// ── The monthly report ────────────────────────────────────────
// A full-screen layer over the whole app (it covers the tab bar).
//
// The first time a month's report opens it plays as a story (Story.jsx):
// up to nine cards, one at a time, turning by themselves. After the last
// one — or «تخطّي» — it is a page to come back to, the summary: the same
// cards stacked one under the other, then «كل الأرقام» and the months
// before. Whether a month's story was seen is kept under its own new key
// (hf_report_seen, reportStory.js), so it plays once; «شغّل القصة» in the
// bar plays it again.
//
// The summary is two fixed parts, so nothing ever floats over the text:
// a solid 56pt bar (close at the start; replay and share at the end) and
// the scroller. Each card plays its entrance once, as it arrives; under
// reduced motion nothing moves.

import { useEffect, useMemo, useRef, useState } from 'react'
import { X, ShareFat, Play, Minus, Plus } from '../kit/icons.js'
import { Sheet, Button, Segmented, IconButton, Num } from '../kit/index.jsx'
import { Bidi, Wordmark } from './parts.jsx'
import Story from './Story.jsx'
import { CARDS } from './cards/Cards.jsx'
import AllNumbers from './sections/AllNumbers.jsx'
import Months from './sections/Months.jsx'
import '../../styles/screens/report.css'
import '../../styles/screens/report-story.css'
import { lockScroll } from '../../scrollLock.js'
import { useReveal } from '../../hooks/useMotion.js'
import { storyCards, beforeAfter, goalEditable, liftGoalOptions } from '../../reportStory.js'
import { expectedSessions, nextMonth, monthName, kgText } from '../../monthReport.js'
import { arabicName } from '../../exerciseMedia.js'
import { unitAr } from '../../streak.js'
import { roundToPlate, PLATE_STEP } from '../../utils.js'

// ShareFat is a forward arrow: under RTL forward points left.
const ShareRtl = (props) => <ShareFat {...props} mirrored />

/** The share button in the bar: a neutral 44pt icon, a spinner while
 *  the poster is being drawn. */
function ShareIcon({ onShare, sharing }) {
  return (
    <button
      type="button"
      className="k-iconbtn k-iconbtn-ghost rp-bar-btn"
      style={{ width: 44, height: 44 }}
      onClick={() => onShare?.('month')}
      disabled={!!sharing}
      aria-busy={sharing ? true : undefined}
      aria-label={sharing ? 'جارٍ تجهيز صورة التقرير' : 'مشاركة التقرير'}
      title={sharing ? 'جارٍ تجهيز الصورة…' : 'مشاركة التقرير'}
    >
      {sharing
        ? <span className="rp-spin" aria-hidden="true" />
        : <ShareRtl size={22} weight="regular" aria-hidden="true" />}
    </button>
  )
}

/** One card on the summary page: it plays once, as it arrives. */
function StackCard({ k, report, ctx }) {
  const [ref, revealed] = useReveal({ threshold: 0.12 })
  const Card = CARDS[k]
  return (
    <div ref={ref} className="rs-stack-item">
      <Card report={report} playing={revealed} story={false} ctx={ctx} />
    </div>
  )
}

// ── The month's goal ──────────────────────────────────────────
// Sessions by default — come to N sessions — or a weight to reach in one
// of his lifts. Set for the month after the report's.
function GoalSheet({ open, onClose, month, report, current, suggested, mapping, onSave }) {
  const lifts = useMemo(() => liftGoalOptions(report), [report])
  const [kind, setKind] = useState(current?.kind || 'sessions')
  const [sessions, setSessions] = useState(current?.kind === 'sessions' ? current.target : suggested?.target || 12)
  const firstLift = current?.kind === 'lift' ? Math.max(0, lifts.findIndex(l => l.lift === current.lift)) : 0
  const [pick, setPick] = useState(firstLift)
  const [kg, setKg] = useState(current?.kind === 'lift' ? current.target : lifts[firstLift]?.target || 0)
  const lift = lifts[pick]
  const nm = monthName(month)
  const save = () => {
    if (kind === 'lift' && lift) onSave({ kind: 'lift', lift: lift.lift, exercise: lift.exercise, target: kg })
    else onSave({ kind: 'sessions', target: sessions })
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title={`هدف ${nm}`}
      footer={<Button variant="primary" size="lg" full onClick={save}>ثبّت الهدف</Button>}>
      <div className="rs-goalsheet">
        {lifts.length > 0 && (
          <Segmented label="نوع الهدف" value={kind} onChange={setKind}
            options={[{ value: 'sessions', label: 'جلسات' }, { value: 'lift', label: 'وزن' }]} />
        )}
        {kind === 'sessions' || !lift ? (
          <div className="rs-gs-row">
            <p>كم جلسة تبي تحضر في {nm}؟</p>
            <div className="rs-gs-step">
              <IconButton icon={Plus} label="زِد جلسة" variant="filled" onClick={() => setSessions(v => Math.min(31, v + 1))} />
              <b><Num>{sessions}</Num> <span>{unitAr(sessions, 'session')}</span></b>
              <IconButton icon={Minus} label="نقّص جلسة" variant="filled" onClick={() => setSessions(v => Math.max(1, v - 1))} />
            </div>
            {suggested?.target ? <p className="rs-gs-hint">خطتك فيها <Num>{suggested.target}</Num> {unitAr(suggested.target, 'session')} في {nm}.</p> : null}
          </div>
        ) : (
          <div className="rs-gs-row">
            <p>أي تمرين؟</p>
            <div className="rs-gs-lifts" role="radiogroup" aria-label="التمرين">
              {lifts.map((l, i) => (
                <button key={l.lift} type="button" role="radio" aria-checked={i === pick}
                  className={`k-chip k-chip-neutral${i === pick ? ' k-chip-on' : ''}`}
                  onClick={() => { setPick(i); setKg(l.target) }}>
                  {arabicName(l.exercise, mapping) || l.exercise}
                </button>
              ))}
            </div>
            <p>كم كيلو تبي توصل؟</p>
            <div className="rs-gs-step">
              <IconButton icon={Plus} label="زِد" variant="filled" onClick={() => setKg(v => roundToPlate(v + PLATE_STEP))} />
              <b><Num>{kgText(kg)}</Num> <span>كجم</span></b>
              <IconButton icon={Minus} label="نقّص" variant="filled" onClick={() => setKg(v => Math.max(PLATE_STEP, roundToPlate(v - PLATE_STEP)))} />
            </div>
            <p className="rs-gs-hint">أثقل وزن رفعته فيه <Num>{kgText(lift.best)}</Num> كجم.</p>
          </div>
        )}
      </div>
    </Sheet>
  )
}

export default function MonthReport({
  report, onClose, onShare, sharing = false,
  // Optional — the report works without them:
  mapping = {},          // the user's exercise aliases, for Arabic names
  liveStreak = null,     // the streak right now, for a month still running
  today,                 // the app's day key; defaults to todayKey()
  months = null,         // { trail, older } for the past-month picker
  onPickMonth,           // open another month's report in place
  storyFirst = false,    // play the story first (this month's was never seen)
  onStorySeen,           // (month) → remember it was seen
  photos = [],           // progress photos, for «قبل وبعد»
  profile = {},          // his name, for the poster
  config = {},           // the recovery settings: the next month's sessions
  onApplyNext,           // (report, items) → { text, undo } — «طبّقها على خطتي»
  appliedBefore = false, // «طبّقها» was already used for this month (hf_report_applied)
  onSetGoal,             // (month, goal) — next month's goal
}) {
  const root = useRef(null)
  const scroller = useRef(null)
  const closeBtn = useRef(null)
  const [scrolled, setScrolled] = useState(false)
  const [pastCover, setPastCover] = useState(false)
  // Said once, politely, when another month opens in place.
  const [announce, setAnnounce] = useState('')
  const shownMonth = useRef(report?.month)
  const has = !!report?.hasData

  const pair = useMemo(() => (has ? beforeAfter(photos, report.month) : null), [has, photos, report?.month])
  const cards = useMemo(() => storyCards(report, { pair }), [report, pair])
  const [story, setStory] = useState(() => !!(storyFirst && has && cards.length))
  const [applied, setApplied] = useState(null)
  const [goalOpen, setGoalOpen] = useState(false)

  // Escape closes, the page behind must not scroll while this is up,
  // and keyboard focus starts inside the layer — and goes back to what
  // opened it (Home's row) when it closes, never to the page itself.
  const closeRef = useRef(null)
  const seenRef = useRef(null)
  const close = () => {
    if (story && has) onStorySeen?.(report.month)
    onClose?.()
  }
  closeRef.current = close
  useEffect(() => {
    const opener = typeof document !== 'undefined' ? document.activeElement : null
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      // A sheet over the report closes first.
      if (document.querySelector('.k-sheet')) return
      closeRef.current?.()
    }
    window.addEventListener('keydown', onKey)
    const release = lockScroll()
    // The story itself, not its ×: Space then holds the story (Story.jsx)
    // instead of pressing «إغلاق» and closing the whole report.
    const first = root.current?.querySelector('.rs-story') || closeBtn.current
    first?.focus?.({ preventScroll: true, focusVisible: false })
    return () => {
      window.removeEventListener('keydown', onKey)
      release()
      if (opener && opener !== document.body && opener.isConnected) opener.focus?.({ preventScroll: true })
    }
  }, [])

  // After the story, the summary opens at the top with focus on its title.
  const endStory = () => {
    if (has) onStorySeen?.(report.month)
    seenRef.current = true
    setStory(false)
  }
  useEffect(() => {
    if (story || !seenRef.current) return
    seenRef.current = null
    if (scroller.current) scroller.current.scrollTop = 0
    const t = root.current?.querySelector('.rp-cover-title') || closeBtn.current
    t?.focus?.({ preventScroll: true })
  }, [story])

  // Another month opens at its own cover. The button that opened it went
  // with the old month's report, so focus moves to the new cover's title
  // rather than dropping to the page, and the change is said out loud.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0
    if (!report?.month || report.month === shownMonth.current) return
    shownMonth.current = report.month
    setAnnounce(`تقرير ${report.monthLabel}`)
    scroller.current?.querySelector('.rp-cover-title')?.focus?.({ preventScroll: true })
  }, [report?.month])

  // The bar's hairline, and its title once the cover is gone.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    let frame = 0
    const measure = () => {
      frame = 0
      setScrolled(el.scrollTop > 4)
      setPastCover(el.scrollTop > (el.querySelector('.rp-cover')?.offsetHeight || 300) - 72)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure) }
    el.addEventListener('scroll', onScroll, { passive: true })
    measure()
    return () => { el.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame) }
  }, [story])

  // ── What the cards can do ──
  const next = has ? nextMonth(report.month) : null
  const editable = has && goalEditable(report.month, today || new Date().toISOString().slice(0, 10))
  const suggested = has ? { kind: 'sessions', target: expectedSessions(config, next) } : null
  const nextGoal = report?.nextGoal || null
  const ctx = {
    mapping, liveStreak, today, pair, profile, sharing,
    onShare,
    next: {
      editable,
      goal: nextGoal,
      suggested,
      applied: applied && applied.month === report?.month ? applied : null,
      appliedBefore,
      onApply: onApplyNext ? (items) => {
        const r = onApplyNext(report, items)
        if (r) setApplied({ month: report.month, ...r })
      } : null,
      onUndo: () => { applied?.undo?.(); setApplied(null) },
      onSetGoal: onSetGoal ? (goal) => onSetGoal(next, goal) : null,
      onEditGoal: onSetGoal ? () => setGoalOpen(true) : null,
    },
  }

  return (
    <div ref={root} className="rp" role="dialog" aria-modal="true" aria-label={`تقرير ${report?.monthLabel || 'الشهر'}`}>
      {story ? (
        <Story report={report} cards={cards} ctx={ctx} onDone={endStory} onClose={close} />
      ) : (
        <>
          <header className="rp-bar" data-scrolled={scrolled ? '1' : undefined}>
            <button
              ref={closeBtn}
              type="button"
              className="k-iconbtn k-iconbtn-ghost rp-bar-btn"
              style={{ width: 44, height: 44 }}
              onClick={close}
              aria-label="إغلاق"
              title="إغلاق"
            >
              <X size={22} weight="regular" aria-hidden="true" />
            </button>
            <span className={`rp-bar-title${pastCover ? ' is-on' : ''}`} aria-hidden={!pastCover}>
              تقرير <Bidi text={report?.monthLabel || ''} />
            </span>
            {has ? (
              <span className="rp-bar-end">
                <button type="button" className="k-iconbtn k-iconbtn-ghost rp-bar-btn rp-replay" style={{ width: 44, height: 44 }}
                  onClick={() => setStory(true)} aria-label="شغّل القصة" title="شغّل القصة">
                  <Play size={20} weight="fill" aria-hidden="true" />
                </button>
                <ShareIcon onShare={onShare} sharing={sharing} />
              </span>
            ) : <span style={{ width: 44 }} />}
          </header>

          <p className="rp-sr" role="status" aria-live="polite">{announce}</p>

          <div ref={scroller} className="rp-scroll">
            {has ? (
              // Keyed by month: opening another month replays the entrances.
              <div key={report.month}>
                <div className="rs-stack">
                  {cards.map(k => <StackCard key={k} k={k} report={report} ctx={ctx} />)}
                </div>
                <div className="rp-body">
                  <AllNumbers report={report} />
                  <Months report={report} trail={months?.trail} older={months?.older} onPick={onPickMonth} />
                  <footer className="rp-foot">
                    <Wordmark height={22} />
                    <span><Bidi text={report.monthLabel} /></span>
                  </footer>
                </div>
              </div>
            ) : (
              <div className="rp-empty">
                <strong>ما فيه شي نعرضه لهالشهر</strong>
                <p>سجّل جلساتك، وآخر الشهر يطلع لك تقريرك هنا.</p>
              </div>
            )}
          </div>
        </>
      )}
      {goalOpen && has && (
        <GoalSheet open onClose={() => setGoalOpen(false)} month={next} report={report}
          current={nextGoal} suggested={suggested} mapping={mapping}
          onSave={(goal) => onSetGoal?.(next, goal)} />
      )}
    </div>
  )
}
