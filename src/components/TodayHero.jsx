import { useEffect, useMemo, useRef, useState } from 'react'
import Art, { useHasArt } from '../assets/Art.jsx'
import DayPreviewSheet from './DayPreviewSheet.jsx'
import { Button, IconButton, Num, Weight, Sheet, ListGroup, ListRow } from './kit/index.jsx'
import { DotsThree, ArrowUp, CaretLeft, SkipForward, ListChecks, Drop } from './kit/icons.js'
import { EXERCISE_ALTERNATIVES } from '../constants.js'
import { substitutedName, getExerciseStats, planDayTitle, durationShort } from '../utils.js'
import { analyzeProgression, DEFAULT_REP_TARGET } from '../progression.js'
import { deloadWeight } from '../deload.js'
import { countAr, unitAr } from '../streak.js'
import { ExerciseThumb, exerciseNames, withNums } from './home/HomeBits.jsx'
import { dayWord, musclesLine, mainMuscle, muscleArt, estimateMinutes } from './home/dayParts.js'

// ── Today — the one lit moment on Home ────────────────────────
//
// Floodlight («تحت الأضواء»): a full-bleed stage, neutral light, the
// day's main muscle standing at the end edge, and the day said as ONE
// Arabic word at 56/800 — «دفع», «سحب», «أرجل» — with the muscles under
// it and «6 تمارين · ≈45 د». Then the first three exercises as open
// rows (picture, Arabic name, last weight, a gold ↑ only when the
// progression engine says raise), «+N تمارين ‹» for the rest, and ONE
// green button, «ابدأ التمرين».
//
// The button is the last thing in the section, and it docks above the
// tab bar while its place is still below the fold, so on an iPhone SE
// it is on screen from the first frame without the rows giving way.
//
// «عرض التمارين» and «تخطي اليوم» are rare decisions; they live behind
// ⋯. Skipping still goes through onSkip → the skip sheet that states
// the cost to the streak first.
//
// Other states keep their meaning: a running session (the stage names
// it and offers a quiet «أكمل التمرين» — the live bar at the foot of
// the screen is the main way back, so no second green button sits
// under it), a rest day (the word «راحة» in the rest blue, no green
// anywhere, a quiet «أبي أتمرّن» — the day sheet offers the same and
// nothing else), today already done (this block goes quiet), and no
// plan (a free session).
//
// Under a deload the rows show the weight the session will actually
// load (the last weight made lighter by the deload's percentage, as the
// player does) and never the gold «raise» arrow: the week is meant to
// be light, and Home must not say the opposite of the player.

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
  const raise = !onDeload && analyzeProgression(sessions, shownName, exerciseMapping, repTarget).hint === 'raise'
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
            {onDeload && <Drop size={14} weight="fill" className="hm-deload-mark" aria-label="وزن الديلود" />}
            <Weight kg={today} />
          </span>
        )}
      </button>
    </li>
  )
}

export default function TodayHero({
  active, currentPlanDay, planDayNum, planTotal,
  isRecoveryDay, completedToday = false, streakKind = null, deload,
  sessions = [], exerciseMapping = {}, exerciseSubs = {}, onCycleSub,
  onStartPlanned, onStartEmpty, onSkip, onGoToWorkout, onOverrideRecovery,
  repTarget = DEFAULT_REP_TARGET,
}) {
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
  // is the sheet's to explain («ليش N؟»); the stage just says saved.
  const notCounting = streakKind === 'reset'
  const planned = !active && !resting && !done && !!currentPlanDay
  const free = !active && !resting && !done && !currentPlanDay

  // Menu choices run after the menu has slid away, so its sheet hands
  // the page back (inert off, focus to ⋯) before the next one takes it.
  const fromMenu = (fn) => () => { setShowMenu(false); setTimeout(fn, 240) }

  const start = () => currentPlanDay ? onStartPlanned(currentPlanDay) : onStartEmpty()

  // ── What the stage says ──
  const dayOf = active || currentPlanDay
  const { word, variant, latin } = dayOf ? dayWord(dayOf) : { word: '', variant: '', latin: false }
  const muscles = dayOf ? musclesLine(dayOf, word) : ''
  const mins = currentPlanDay ? estimateMinutes(currentPlanDay) : 0
  const muscle = dayOf ? mainMuscle(dayOf) : null
  const art = muscleArt(muscle)

  // The art: the day's main muscle. Under a deload the pack's glacier
  // hero takes the stage when it is installed; without it the muscle
  // art is cooled to the deload's blue so no lime survives the mode.
  const hasDeloadArt = useHasArt('deload_hero')
  let stageArt = null
  let artShown = false
  if (resting) {
    artShown = true
    stageArt = <img className="k-stage-art hm-art-rest" src="/assets/hero_rest.webp" alt="" />
  } else if ((planned || free || active) && onDeload) {
    const cooled = art ? <img className="k-stage-art hm-art-cool" src={art} alt="" /> : null
    stageArt = <Art id="deload_hero" className="k-stage-art hm-art-deload" alt="" fallback={cooled} />
    artShown = hasDeloadArt || !!cooled
  } else if ((planned || active) && art) {
    stageArt = <img className="k-stage-art" src={art} alt="" />
    artShown = true
  }

  // How far into the deload, said where the day is.
  const deloadChip = onDeload && !resting && !done ? (
    <span className="hm-chip-deload">
      <Art id="deload_badge" size={14} fallback={<Drop size={14} weight="fill" aria-hidden="true" />} />
      <span>ديلود · اليوم <Num>{deload.day}</Num> من <Num>{deload.totalDays}</Num></span>
    </span>
  ) : null

  const shown = exercises.slice(0, 3)
  const more = exCount - shown.length

  return (
    <section className={`hm-today${done ? ' is-done' : ''}${resting ? ' is-rest' : ''}`} aria-label="تمرين اليوم">
      <div className={`k-stage hm-stage${done ? ' hm-stage-quiet' : ''}${resting ? ' hm-stage-rest' : ''}${artShown ? '' : ' hm-stage-noart'}`}>
        {stageArt}

        {planned && (
          <IconButton icon={DotsThree} label="خيارات اليوم" weight="bold"
            className="hm-more-btn" onClick={openMenu} />
        )}

        <div className="k-stage-body hm-stage-body">
          <span className="hm-eyebrow">
            {active
              ? <><i className="hm-live-dot" aria-hidden="true" />جلسة شغّالة</>
              : 'اليوم'}
            {deloadChip}
          </span>

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

          {/* The second line: the muscles on a training day, what the
              day means on the others. */}
          {active && ctx ? (
            <p className="hm-line">{ctx.name}</p>
          ) : resting ? (
            <p className="hm-line hm-line-sm">راحة مجدولة — عضلاتك تبني وانت مرتاح</p>
          ) : done ? (
            <p className="hm-line hm-line-sm">شغل اليوم انحفظ — ارتاح وكُل زين.</p>
          ) : planned ? (
            muscles && <p className="hm-line">{muscles}</p>
          ) : (
            <p className="hm-line hm-line-sm">بلا خطة — فعّل وحدة من الإعدادات، أو ابدأ جلسة حرة.</p>
          )}

          {active && ctx ? (
            <p className="hm-meta">
              المجموعة <Num>{ctx.setNo}</Num> من <Num>{ctx.setTotal}</Num> · أنجزت <Num>{ctx.done}</Num> من <Num>{ctx.total}</Num>
            </p>
          ) : resting && currentPlanDay ? (
            <p className="hm-meta">بكرة: {dayWord(currentPlanDay).word || planDayTitle(currentPlanDay)} · {withNums(countAr(exCount, 'workout'))}</p>
          ) : planned ? (
            <p className="hm-meta">
              {withNums(countAr(exCount, 'workout'))}
              {mins > 0 && <> · ≈<Num>{durationShort(mins)}</Num></>}
              {onDeload && <> · أخف بـ<Num>{deload.pct}%</Num></>}
            </p>
          ) : null}

          {/* A running session: the live bar at the foot of the screen
              is the way back; the stage offers it too, quietly, where
              nothing floats over it. */}
          {active && (
            <Button variant="secondary" size="md" className="hm-resume" onClick={onGoToWorkout}>
              أكمل التمرين
            </Button>
          )}
        </div>
      </div>

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
        <Sheet key={menuKey} open={showMenu} onClose={() => setShowMenu(false)} title="خيارات اليوم">
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
          </ListGroup>
        </Sheet>
      )}

      {currentPlanDay && (
        <DayPreviewSheet
          key={sheetKey}
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
            // skip). Training anyway goes the stage's way — through the
            // override — so the sheet and the stage never disagree.
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
