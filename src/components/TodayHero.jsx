import { useEffect, useMemo, useRef, useState } from 'react'
import Art from '../assets/Art.jsx'
import DayPreviewSheet from './DayPreviewSheet.jsx'
import { Button, IconButton, Num, Weight, Sheet, ListGroup, ListRow } from './kit/index.jsx'
import { DotsThree, ArrowUp, CaretLeft, SkipForward, ListChecks, Drop, PencilSimple } from './kit/icons.js'
import { EXERCISE_ALTERNATIVES } from '../constants.js'
import { substitutedName, getExerciseStats, planDayTitle, durationShort } from '../utils.js'
import { analyzeProgression, DEFAULT_REP_TARGET, effectiveRepTarget } from '../progression.js'
import { deloadWeight } from '../deload.js'
import { countAr, unitAr } from '../streak.js'
import { ExerciseThumb, exerciseNames, withNums } from './home/HomeBits.jsx'
import { dayWord, musclesLine, mainMuscle, muscleArt, estimateMinutes } from './home/dayParts.js'
import { animate, reducedMotion } from '../motion.js'

// ── Today — what the day is, and one tap to start ─────────────
//
// حمزة: «الشاشة الرئيسية مكدسة والصورة كبيرة مرة بشكل غير احترافي». So
// the day is a head, not a stage: a small badge of the day's main muscle
// (64pt, the same family as the exercise pictures under it), the day as
// one Arabic word — «دفع», «سحب», «أرجل» — and ONE meta line under it:
// «صدر، أكتاف، ترايسبس · 6 تمارين · ≈45 د». ⋯ sits at the far end of the
// word's line, never on the picture. Then the first three exercises as
// open rows (picture, Arabic name, English under it, the weight, a gold ↑
// only when the progression engine says raise), «+N تمارين ‹» for the
// rest, and ONE green button, «ابدأ التمرين».
//
// The button is the last thing in the section, and it docks above the
// tab bar while its place is still below the fold, so on an iPhone SE
// it is on screen from the first frame without the rows giving way.
//
// «عرض التمارين» and «تخطي اليوم» are rare decisions; they live behind
// ⋯. Skipping still goes through onSkip → the skip sheet that states
// the cost to the streak first.
//
// A deload is said once, where the day is: the line over the word turns
// into the deload's mark — «ديلود · يوم 1 من 7 · أخف 40%» in the deload
// blue, with its droplet. The rows show the weight the session will
// actually load (the last weight made lighter by the deload's
// percentage, as the player does) with no mark of their own, and never
// the gold «raise» arrow: the week is meant to be light, and Home must
// not say the opposite of the player. No iced picture over Home.
//
// Other states keep their meaning: a running session (the head names it
// and offers a quiet «أكمل التمرين» — the live bar at the foot of the
// screen is the main way back, so no second green button sits under
// it), a rest day (the word «راحة» in the rest blue, the moon in the
// badge, no green anywhere, a quiet «أبي أتمرّن» — the day sheet offers
// the same and nothing else), today already done (no badge, the block
// goes quiet), and no plan (a free session).
//
// The way in (home.css, .hm-enter): the first time Home shows after the
// app opens, the badge settles in, the day's word wipes in, the meta
// line and the exercises follow one by one and the button gets one
// sheen. Once per app open — remembered in memory, not storage — never
// on a tab switch. Reduced motion: one fade (src/motion.js). Back from a
// workout (`calm`, the moment the streak's flame lights) the quiet head
// rises in.

// The first Home of this app run gets the entrance.
let firstHome = true

function sessionContext(active, mapping) {
  if (!active?.exercises?.length) return null
  const all = active.exercises.flatMap(ex => ex.sets)
  const done = all.filter(s => s.done).length
  const current = active.exercises.find(ex => ex.sets.length && !ex.sets.every(s => s.done))
    || active.exercises[active.exercises.length - 1]
  const exDone = current.sets.filter(s => s.done).length
  return {
    name: exerciseNames(current.name, mapping).ar,
    setNo: Math.min(exDone + 1, current.sets.length),
    setTotal: current.sets.length,
    done,
    total: all.length,
  }
}

/** «+3 تمارين», «+ تمرينين», «+ تمرين واحد». */
const moreLabel = (n) => n <= 2
  ? <>+ {countAr(n, 'workout')}</>
  : <><Num>+{n}</Num> {unitAr(n, 'workout')}</>

// The green button docks above the tab bar while its own place in the
// column is still below the fold, and sits in the column again once you
// scroll to it. position:sticky does the moving; a sentinel just under
// it says when it is floating, which is the only time it casts a shadow.
function Dock({ children }) {
  const sentinel = useRef(null)
  const [docked, setDocked] = useState(false)
  useEffect(() => {
    const el = sentinel.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    // What the tab bar covers at the bottom, measured rather than
    // assumed, so the safe area on a real phone is counted too.
    const tabs = document.querySelector('.f-tabs')
    const covered = tabs ? Math.max(0, Math.ceil(window.innerHeight - tabs.getBoundingClientRect().top)) : 64
    const io = new IntersectionObserver(([e]) => {
      setDocked(!e.isIntersecting && e.boundingClientRect.top > 0)
    }, { threshold: 0, rootMargin: `0px 0px -${covered + 8}px 0px` })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <>
      <div className={`hm-dock is-sticky${docked ? ' is-docked' : ''}`}>{children}</div>
      <i ref={sentinel} className="hm-dock-sentinel" aria-hidden="true" />
    </>
  )
}

function ExerciseRow({ ex, sessions, exerciseMapping, exerciseSubs, repTarget, deload, onOpen }) {
  const shownName = substitutedName(ex.name, exerciseSubs, EXERCISE_ALTERNATIVES)
  const { ar, en } = exerciseNames(shownName, exerciseMapping)
  const { lastWeight } = getExerciseStats(sessions, shownName, exerciseMapping)
  const onDeload = !!deload?.active
  // Silenced during a deload, exactly as the player silences it.
  const raise = !onDeload && analyzeProgression(sessions, shownName, exerciseMapping, effectiveRepTarget(ex, repTarget)).hint === 'raise'
  const today = lastWeight != null && onDeload ? deloadWeight(lastWeight, deload.pct) : lastWeight
  return (
    <li>
      <button type="button" className="hm-row" onClick={onOpen}>
        <ExerciseThumb name={shownName} muscle={ex.muscle} />
        <span className="hm-row-main">
          <span className="hm-row-ar">{ar}</span>
          {en && <span className="hm-row-en" dir="ltr">{en}</span>}
        </span>
        {today != null && (
          <span className="hm-row-w"
            title={onDeload ? `وزن الديلود — آخر مرة ${lastWeight} كجم` : undefined}>
            {raise && <ArrowUp size={14} weight="bold" className="hm-raise" aria-label="ارفع الوزن" />}
            <Weight kg={today} />
          </span>
        )}
      </button>
    </li>
  )
}

/** The day's badge: its picture in a 64pt tile, the exercise pictures'
 *  family. `rest` lights the moon in the rest blue. */
function DayBadge({ src, rest = false }) {
  if (!src) return null
  return (
    <span className={`hm-badge${rest ? ' is-rest' : ''}`} aria-hidden="true" data-testid="day-badge">
      <img src={src} alt="" />
    </span>
  )
}

export default function TodayHero({
  active, currentPlanDay,
  isRecoveryDay, completedToday = false, streakKind = null, deload,
  sessions = [], exerciseMapping = {}, exerciseSubs = {}, onCycleSub,
  onStartPlanned, onStartEmpty, onSkip, onGoToWorkout, onOverrideRecovery,
  repTarget = DEFAULT_REP_TARGET, calm = false, onEditPlan,
}) {
  const [enter, setEnter] = useState(firstHome)
  const section = useRef(null)
  useEffect(() => {
    firstHome = false
    if (!enter) return
    if (reducedMotion()) {
      const a = animate(section.current, [{ opacity: 0 }, { opacity: 1 }], { d: 300, e: 'linear' })
      return () => { try { a?.cancel() } catch {} }
    }
    // Off once it has played, so nothing later re-runs it.
    const t = setTimeout(() => setEnter(false), 1600)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [showSheet, setShowSheet] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  // Each opening is a fresh sheet, so the kit's sheet reads the button
  // that opened it (and hands focus back to it) at the moment it opens.
  const [sheetKey, setSheetKey] = useState(0)
  const [menuKey, setMenuKey] = useState(0)
  const openSheet = () => { setSheetKey(k => k + 1); setShowSheet(true) }
  const openMenu = () => { setMenuKey(k => k + 1); setShowMenu(true) }
  const onDeload = !!deload?.active

  const ctx = useMemo(() => sessionContext(active, exerciseMapping), [active, exerciseMapping])
  const exercises = currentPlanDay?.exercises || []
  const exCount = exercises.length

  const resting = isRecoveryDay && !active
  // Today already counts (the flame by the number is filled), and this
  // block must not keep asking for the workout that was just done.
  const done = completedToday && !active && !resting
  // A second plan change inside 30 days starts the streak again from
  // tomorrow, so on that day a saved session is saved, not counted. Why
  // is the sheet's to explain («ليش N؟»); the head just says saved.
  const notCounting = streakKind === 'reset'
  const planned = !active && !resting && !done && !!currentPlanDay

  // Menu choices run after the menu has slid away, so its sheet hands
  // the page back (inert off, focus to ⋯) before the next one takes it.
  const fromMenu = (fn) => () => { setShowMenu(false); setTimeout(fn, 240) }

  const start = () => currentPlanDay ? onStartPlanned(currentPlanDay) : onStartEmpty()

  // ── What the head says ──
  const dayOf = active || currentPlanDay
  const { word, variant, latin } = dayOf ? dayWord(dayOf) : { word: '', variant: '', latin: false }
  const muscles = dayOf ? musclesLine(dayOf, word) : ''
  const mins = currentPlanDay ? estimateMinutes(currentPlanDay) : 0
  const art = muscleArt(dayOf ? mainMuscle(dayOf) : null)

  // The badge: the day's main muscle (cooled to the deload's blue by
  // home.css while one runs); the moon on a rest day; none when the day
  // is done or there is no plan.
  const badge = resting ? <DayBadge src="/assets/hero_rest.webp" rest />
    : (planned || active) && art ? <DayBadge src={art} />
      : null

  // The line over the word: «اليوم», a running session, or — the one
  // place a deload is said on Home — how far in and how much lighter.
  const eyebrow = active ? (
    <p className="hm-eyebrow"><i className="hm-live-dot" aria-hidden="true" />جلسة شغّالة</p>
  ) : onDeload && !resting && !done ? (
    <p className="hm-eyebrow hm-deload" data-testid="deload-mark">
      <Art id="deload_badge" size={14} fallback={<Drop size={14} weight="fill" aria-hidden="true" />} />
      <span>ديلود</span>
      <span>يوم <Num>{deload.day}</Num> من <Num>{deload.totalDays}</Num></span>
      <span>أخف <Num>{deload.pct}%</Num></span>
    </p>
  ) : (
    <p className="hm-eyebrow">اليوم</p>
  )

  // The meta line: its facts as parts, the dots between them drawn by
  // CSS so a narrow phone breaks between facts, never inside one.
  const meta = active && ctx ? [
    ctx.name,
    <>المجموعة <Num>{ctx.setNo}</Num> من <Num>{ctx.setTotal}</Num></>,
    <>أنجزت <Num>{ctx.done}</Num> من <Num>{ctx.total}</Num></>,
  ] : resting ? [
    'راحة مجدولة',
    currentPlanDay ? <>بكرة: {dayWord(currentPlanDay).word || planDayTitle(currentPlanDay)}</> : null,
  ] : planned ? [
    muscles || null,
    withNums(countAr(exCount, 'workout')),
    mins > 0 ? <>≈<Num>{durationShort(mins)}</Num></> : null,
  ] : null

  const shown = exercises.slice(0, 3)
  const more = exCount - shown.length

  return (
    <section ref={section} className={`hm-today${done ? ' is-done' : ''}${resting ? ' is-rest' : ''}${enter ? ' hm-enter' : ''}${calm ? ' hm-calm' : ''}`} aria-label="تمرين اليوم">
      <header className={`hm-head${badge ? '' : ' is-bare'}${done ? ' is-quiet' : ''}`}>
        {badge}
        {eyebrow}

        {active ? (
          <h2 className={`hm-word${latin ? ' is-latin' : ''}`}>
            {word || 'تمرين حر'}{variant && <Num className="hm-word-variant">{variant}</Num>}
          </h2>
        ) : resting ? (
          <h2 className="hm-word hm-word-rest">راحة</h2>
        ) : done ? (
          <h2 className="hm-title">{notCounting ? 'انحفظت جلسة اليوم' : 'تمرين اليوم خلص'}</h2>
        ) : planned ? (
          <h2 className={`hm-word${latin ? ' is-latin' : ''}`}>
            {word || planDayTitle(currentPlanDay)}{variant && <Num className="hm-word-variant">{variant}</Num>}
          </h2>
        ) : (
          <h2 className="hm-word">تمرين حر</h2>
        )}

        {planned && (
          <IconButton icon={DotsThree} label="خيارات اليوم" weight="bold"
            className="hm-more-btn" onClick={openMenu} />
        )}

        {meta ? (
          <p className="hm-meta"><span className="hm-meta-in">{meta.filter(Boolean).map((m, i) => <span key={i}>{m}</span>)}</span></p>
        ) : done ? (
          <p className="hm-meta hm-meta-line">شغل اليوم انحفظ — ارتاح وكُل زين.</p>
        ) : (
          <p className="hm-meta hm-meta-line">بلا خطة — جلسة حرة بالتمارين اللي تختارها.</p>
        )}
      </header>

      {/* A running session: the live bar at the foot of the screen is
          the way back; the head offers it too, quietly, where nothing
          floats over it. */}
      {active && (
        <div className="hm-quiet-actions is-start">
          <Button variant="secondary" size="md" className="hm-resume" onClick={onGoToWorkout}>
            أكمل التمرين
          </Button>
        </div>
      )}

      {/* ── The first three exercises, open rows on the ground ── */}
      {planned && shown.length > 0 && (
        <ul className="hm-rows" aria-label="أول التمارين">
          {shown.map((ex, i) => (
            <ExerciseRow key={i} ex={ex} sessions={sessions} exerciseMapping={exerciseMapping}
              exerciseSubs={exerciseSubs} repTarget={repTarget} deload={deload} onOpen={openSheet} />
          ))}
        </ul>
      )}
      {planned && more > 0 && (
        <button type="button" className="hm-more" onClick={openSheet}>
          <span>{moreLabel(more)}</span>
          <CaretLeft size={16} weight="bold" aria-hidden="true" />
        </button>
      )}

      {/* ── The one action ── */}
      {active ? null : resting ? (
        <div className="hm-quiet-actions">
          <Button variant="secondary" size="lg" full onClick={onOverrideRecovery}>أبي أتمرّن</Button>
          {currentPlanDay && (
            <Button variant="plain" size="md" className="hm-plain" onClick={openSheet}>
              تمارين بكرة
            </Button>
          )}
        </div>
      ) : done ? (
        <div className="hm-quiet-actions">
          <Button variant="secondary" size="lg" full onClick={start}>جلسة زيادة</Button>
        </div>
      ) : (
        <Dock>
          <Button variant="primary" size="lg" full onClick={start}>ابدأ التمرين</Button>
        </Dock>
      )}

      {/* ── ⋯ — the rare decisions ── */}
      {planned && (
        <Sheet key={`menu${menuKey}`} open={showMenu} onClose={() => setShowMenu(false)} title="خيارات اليوم">
          <ListGroup className="hm-menu">
            <ListRow
              leading={ListChecks}
              title="عرض التمارين"
              subtitle={<>كل تمارين اليوم، والاستبدال لو الجهاز مشغول</>}
              chevron
              onClick={fromMenu(openSheet)}
            />
            <ListRow
              leading={<span className="k-row-icon"><SkipForward size={22} mirrored aria-hidden="true" /></span>}
              title="تخطي اليوم"
              subtitle="تنتقل الخطة لليوم الجاي"
              chevron
              onClick={fromMenu(() => onSkip?.())}
            />
            {/* Door 3 to the plan builder: on today's day. */}
            {onEditPlan && (
              <ListRow
                leading={PencilSimple}
                title="عدّل الخطة"
                subtitle="التمارين والمجموعات والعدّات والراحة"
                chevron
                onClick={fromMenu(onEditPlan)}
              />
            )}
          </ListGroup>
        </Sheet>
      )}

      {currentPlanDay && (
        <DayPreviewSheet
          key={`day${sheetKey}`}
          open={showSheet}
          day={currentPlanDay}
          heading={resting ? 'تمارين بكرة' : 'تمارين اليوم'}
          sessions={sessions}
          exerciseMapping={exerciseMapping}
          exerciseSubs={exerciseSubs}
          onCycleSub={onCycleSub}
          repTarget={repTarget}
          deload={deload}
          {...(resting ? {
            // A rest day: no green, no skip (there is nothing owed to
            // skip). Training anyway goes the head's way — through the
            // override — so the sheet and the head never disagree.
            startLabel: 'أبي أتمرّن',
            startVariant: 'secondary',
            onStart: onOverrideRecovery
              ? () => { setShowSheet(false); setTimeout(() => onOverrideRecovery(), 240) }
              : undefined,
          } : {
            onStart: () => { setShowSheet(false); onStartPlanned(currentPlanDay) },
            onSkip: () => { setShowSheet(false); setTimeout(() => onSkip?.(), 240) },
          })}
          onClose={() => setShowSheet(false)}
        />
      )}
    </section>
  )
}
