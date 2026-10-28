import { useState, useEffect, useMemo, useRef } from 'react'
import { Button, ConfirmSheet, EmptyState, Num } from '../components/kit/index.jsx'
import { Barbell, Plus, ListChecks } from '../components/kit/icons.js'
import WorkoutPlayer from '../components/player/WorkoutPlayer.jsx'
import SessionBar from '../components/player/SessionBar.jsx'
import FinishSheet from '../components/player/FinishSheet.jsx'
import { dayWord, previousSets, setsPhrase } from '../components/player/sessionWords.js'
import AddExerciseModal from '../components/AddExerciseModal.jsx'
import RoutinesModal from '../components/RoutinesModal.jsx'
import { buildExercise, blankSet, getExerciseStats, suggestedWeightFor, markSetDone, resolveExerciseName, substitutedName } from '../utils.js'
import { deloadWeight } from '../deload.js'
import { MUSCLE_GROUPS, EXERCISE_ALTERNATIVES } from '../constants.js'
import { rankAlternatives, findPlanRow, sessionDay, swapRow, muscleOf, addRow, setRowSets, MAX_SETS, rotationOf } from '../plan/view.js'
import { swapMember } from '../plan/rotate.js'
import { analyzeProgression, DEFAULT_REP_TARGET, planRepTarget } from '../progression.js'
import { toWesternDigits } from '../day.js'
import '../styles/screens/session.css'

// ── Session mode ──────────────────────────────────────────────
//
// The running session, full screen, with no app chrome around it: a
// 52pt bar (⌄ · «دفع · 07:42» · «إنهاء»), the player, and the one
// docked action. The data rules are the ones this page always had —
// the same handlers, the same stored shape — only the surface changed.
//
// While it is open the screen stays awake (Wake Lock, where the
// platform has it), so the rest countdown and its tones keep running.

// «إضافة مجموعة»'s question: up this long, then gone (= «بس هالمرة»);
// its «انحفظت» answer a moment.
const SET_ASK_MS = 9000
const SET_ASK_DONE_MS = 2400

export default function WorkoutPage({
  active, sessions, onUpdateActive, onFinish, onFinishing, onShowRest, onCloseRest, addXP, onGoBack,
  onMinimize, isResting, exerciseMapping = {}, repTarget = DEFAULT_REP_TARGET,
  exerciseSubs = {}, plan = null, onEditPlan, onClearSub, onOpenPlanView,
}) {
  const [showAdd,       setShowAdd]       = useState(false)
  const [showRoutines,  setShowRoutines]  = useState(false)
  const [askFinish,     setAskFinish]     = useState(false)
  const [askDiscard,    setAskDiscard]    = useState(false)
  // «إضافة مجموعة» on a plan exercise: a small question under its sets —
  // keep the extra set in the plan too? { exId, n, from, done } while up.
  const [setAsk,        setSetAsk]        = useState(null)
  const askTimer = useRef(0)
  useEffect(() => () => clearTimeout(askTimer.current), [])
  const showAsk = (ask, ms) => {
    clearTimeout(askTimer.current)
    setSetAsk(ask)
    if (ask) askTimer.current = setTimeout(() => setSetAsk(null), ms)
  }

  // «إنهاء» asked: whatever the summary will show starts getting ready
  // while the sheet is up (App builds the medal stage ahead).
  useEffect(() => { if (askFinish) onFinishing?.() }, [askFinish]) // eslint-disable-line react-hooks/exhaustive-deps

  // The session clock lives in SessionBar (wall-clock since active.id,
  // the same number finishSession saves), so this page — and the player
  // under it — no longer re-render once a second.

  // What the engines say about an exercise only changes when the history,
  // the alias mapping or the rep target does, so it is worked out once
  // per name instead of on every render of the player.
  const engine = useMemo(() => {
    const cache = new Map()
    const memo = (kind, name, fn) => {
      const key = `${kind}\u0000${name}`
      if (!cache.has(key)) cache.set(key, fn())
      return cache.get(key)
    }
    return {
      // A session exercise whose range he set himself in the builder
      // carries it (target, own: true); the engine aims for that instead
      // of the target set in Settings. Anything else runs on Settings.
      progression: (name, t = null) => memo(t ? `p${t.base}-${t.top}` : 'p', name,
        () => analyzeProgression(sessions, name, exerciseMapping, t || repTarget)),
      stats:       (name) => memo('s', name, () => getExerciseStats(sessions, name, exerciseMapping)),
      previous:    (name) => memo('v', name, () => previousSets(sessions, name, exerciseMapping)),
    }
  }, [sessions, exerciseMapping, repTarget])

  // Keep the screen on for the length of the session. Feature-detected;
  // re-requested when the app comes back, since the system drops the
  // lock whenever the page is hidden.
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    let lock = null
    let alive = true
    const request = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const l = await navigator.wakeLock.request('screen')
        if (alive) lock = l
        else l.release?.().catch(() => {})
      } catch {}
    }
    request()
    const onVis = () => { if (document.visibilityState === 'visible' && (!lock || lock.released)) request() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVis)
      lock?.release?.().catch(() => {})
    }
  }, [active?.id])

  // The history is its own tab (HistoryPage); this page only runs the
  // session, inside the full-screen cover.
  if (!active) return null

  // ── Helpers ──────────────────────────────────────────────────
  const updateEx = (exId, updater) =>
    onUpdateActive(prev => ({
      ...prev,
      exercises: prev.exercises.map(ex => ex.id === exId ? updater(ex) : ex),
    }))

  const handleUpdateSet = (exId, si, field, val) =>
    updateEx(exId, ex => ({
      ...ex,
      sets: ex.sets.map((s, i) => i === si ? { ...s, [field]: toWesternDigits(val) } : s),
    }))

  // A step reads the value it is stepping from inside the update, so a
  // held stepper repeating every 100ms never steps from a stale number.
  const handleStepSet = (exId, si, field, delta) =>
    updateEx(exId, ex => ({
      ...ex,
      sets: ex.sets.map((s, i) => {
        if (i !== si) return s
        if (field === 'weight') {
          const v = Math.max(0, Math.round(((parseFloat(s.weight) || 0) + delta) * 10) / 10)
          return { ...s, weight: String(v) }
        }
        return { ...s, reps: String(Math.max(0, (parseInt(s.reps) || 0) + delta)) }
      }),
    }))

  const handleDoneSet = (exId, si, done, { rest = true } = {}) => {
    if (done) {
      // XP still accrues per set, silently: no toast, no flying number.
      // The set's own row says it is done; a personal best is said on
      // that row in gold.
      if (addXP) addXP(10)
      // The session's very last set rests nowhere: the player asks to
      // finish instead (WorkoutPlayer, FINISH_ASK_MS).
      if (rest) onShowRest()
    }
    // Marking done also carries the numbers into the blank sets that
    // follow — see markSetDone for why and for what it refuses to touch.
    updateEx(exId, ex => ({ ...ex, sets: markSetDone(ex.sets, si, done) }))
  }

  const handleAddSet = (exId) => {
    updateEx(exId, ex => {
      const prev = ex.sets.at(-1)?.weight || ''
      const prevReps = ex.sets[ex.sets.length - 1]?.reps || ''
      return { ...ex, sets: [...ex.sets, blankSet(prev, prevReps)] }
    })
    // One more than his plan has for it: ask, quietly, whether for good.
    // Ignoring it is «بس هالمرة»: the question goes by itself.
    const ex = exercises.find(e => e.id === exId)
    const at = ex && onEditPlan ? planRowOf(ex) : null
    if (!at) return
    const from = Number(plan.weeklySchedule[at.d].exercises[at.j].sets) || 3
    const n = ex.sets.length + 1
    if (n > from && n <= MAX_SETS) showAsk({ exId, n, from, done: false }, SET_ASK_MS)
  }
  // «دايماً بخطتي»: the plan's row gets the sets this session has now.
  const handleSetAskAlways = () => {
    const ask = setAsk
    if (!ask || ask.done) return
    const ex = exercises.find(e => e.id === ask.exId)
    const at = ex ? planRowOf(ex) : null
    if (at) onEditPlan?.(setRowSets(plan, at.d, at.j, ask.n))
    showAsk({ ...ask, done: true }, SET_ASK_DONE_MS)
  }

  const handleRemoveSet = (exId, si) =>
    updateEx(exId, ex => ({ ...ex, sets: ex.sets.filter((_, i) => i !== si) }))

  const handleRemoveEx = (exId) =>
    onUpdateActive(prev => ({ ...prev, exercises: prev.exercises.filter(e => e.id !== exId) }))

  const handleMoveSet = (fromExId, si, toExId) => {
    onUpdateActive(prev => {
      const fromEx = prev.exercises.find(e => e.id === fromExId)
      const set    = fromEx?.sets[si]
      if (!set) return prev
      return {
        ...prev,
        exercises: prev.exercises.map(ex => {
          if (ex.id === fromExId) return { ...ex, sets: ex.sets.filter((_, i) => i !== si) }
          if (ex.id === toExId)   return { ...ex, sets: [...ex.sets, { ...set, done: false }] }
          return ex
        }),
      }
    })
  }

  // The session carries the deload it began under, so an exercise added
  // mid-workout is lightened on the same terms as the ones it started
  // with — even if the stretch itself ended while the session was open.
  const lighten = active?.deload
    ? (w => deloadWeight(w, active.deload.pct))
    : undefined

  const getLastW = (name) =>
    suggestedWeightFor(name, { sessions, mapping: exerciseMapping, transform: lighten })

  // The plan's rep range for an exercise of this session, by name (the
  // player asks by name). Null for a free session or an added exercise.
  const targetFor = (name) => planRepTarget((active.exercises || []).find(e => e.name === name || e.originalName === name))
  const getSuggestedReps = (name) => engine.progression(name, targetFor(name)).suggestedReps

  // Progression is frozen for the length of a deload. The weights are
  // deliberately low, so "add weight" would be wrong and "drop the
  // weight" would be advice about a decline that was the plan.
  const progressionFor = (name) => {
    const p = engine.progression(name, targetFor(name))
    return active?.deload ? { ...p, hint: null } : p
  }

  // The plan row a session exercise came from (day of the session, the
  // plan's own name for it), or null: a free session, an added exercise.
  const planRowOf = (ex) => {
    const d = sessionDay(plan, active)
    if (d == null) return null
    const j = findPlanRow(plan, d, { name: ex.name, originalName: ex.originalName, subs: exerciseSubs })
    return j >= 0 ? { d, j, name: plan.weeklySchedule[d].exercises[j].name } : null
  }

  // Swap a machine mid-workout (SwapSheet): the one he picked, seen first.
  // Only while nothing is logged yet, so completed sets are never
  // re-attributed to a different exercise. «بس هالمرة» changes this
  // session; «دايماً بخطتي» also writes the plan's row, the way «خطتي»
  // does (App's editPlan: free, the day he reached kept).
  const handleSwapTo = (exId, name, { always = false } = {}) => {
    const ex = exercises.find(e => e.id === exId)
    if (!ex || !name || name === ex.name || ex.sets.some(s => s.done)) return
    const origin = ex.originalName || ex.name
    if (always) {
      const at = planRowOf(ex)
      const members = at ? rotationOf(plan.weeklySchedule[at.d].exercises[at.j]) : null
      if (members) {
        // a row that takes turns («بالتناوب»): the name he is on gives its
        // place in them (to one of the turns already: nothing to write)
        const from = members.find(m => m.toLowerCase() === origin.toLowerCase())
          || members.find(m => m.toLowerCase() === ex.name.toLowerCase())
        const next = from ? swapMember(plan, at.d, at.j, from, name) : null
        if (next) onEditPlan?.(next)
        if (next && exerciseSubs[name]) onClearSub?.(name)
      } else if (at) {
        if (at.name.toLowerCase() === name.toLowerCase()) {
          // back to the plan's own: a remembered swap of it goes
          if (exerciseSubs[at.name]) onClearSub?.(at.name)
        } else {
          onEditPlan?.(swapRow(plan, at.d, at.j, name))
          if (exerciseSubs[name]) onClearSub?.(name)
        }
      }
    }
    updateEx(exId, e => ({
      ...e,
      name,
      muscle: muscleOf(name, e.muscle) || e.muscle,
      // what the session started with, said as «بدل …» — none once back to it
      originalName: name === origin ? undefined : origin,
      // the new machine carries its own load history
      sets: e.sets.map(() => blankSet(getLastW(name), getSuggestedReps(name))),
    }))
  }

  // «بالتناوب» (RotateBar): the other one of a row that takes turns, for
  // this time — «بدّلها لـ … هالمرة», before the first set. Nothing is
  // written to his plan: whatever he does is what counts for the turns
  // (src/plan/rotate.js reads it from the saved session). It is the row's
  // own turn, not a swap («بدل …» says nothing); the row's reps and rest
  // stay — one system for the names that share it.
  const handleRotate = (exId, name) => {
    const ex = exercises.find(e => e.id === exId)
    const members = Array.isArray(ex?.rotate) ? ex.rotate : null
    if (!ex || !name || !members?.some(m => m.toLowerCase() === name.toLowerCase()) || ex.sets.some(s => s.done)) return
    const shown = substitutedName(name, exerciseSubs, EXERCISE_ALTERNATIVES)
    if (shown === ex.name) return
    const reps = engine.progression(shown, planRepTarget(ex)).suggestedReps
    updateEx(exId, e => ({
      ...e,
      name: shown,
      muscle: muscleOf(shown, e.muscle) || e.muscle,
      // a remembered swap of that name still runs (and says what it replaced)
      originalName: shown !== name ? name : undefined,
      sets: e.sets.map(() => blankSet(getLastW(shown), reps)),
    }))
  }

  // «إضافة تمرين». In a plan day's session the sheet asks as the swap
  // does: «بس هالمرة» adds it to this session; «دايماً بخطتي» to today's
  // day of his plan as well (addRow: his sets, the reps on Settings, the
  // player's rest — App's editPlan, free for the streak). Not offered for
  // one the day already has (after his remembered swaps, by his mapping).
  const today = sessionDay(plan, active)
  const dayRows = today != null ? (plan?.weeklySchedule?.[today]?.exercises || []) : []
  const word = dayWord(active)
  const addAlways = onEditPlan && today != null ? {
    can: (name) => {
      const k = resolveExerciseName(name, exerciseMapping)
      // (a row that takes turns has every one of its names: «بالتناوب»)
      return !!k && !dayRows.some(x => [x.name, substitutedName(x.name, exerciseSubs, EXERCISE_ALTERNATIVES), ...(rotationOf(x) || [])]
        .some(n => resolveExerciseName(n, exerciseMapping) === k))
    },
    note: `«بس هالمرة» لهالجلسة بس. «دايماً» ينضاف ليوم ${word === 'تمرين' ? 'تمرينك' : word} بخطتك وما يلمس الستريك.`,
  } : null

  const handleAddExercise = ({ muscle, name, numSets, always = false }) => {
    if (always && addAlways?.can(name)) {
      const next = addRow(plan, today, { name, muscle, sets: numSets }, { repTarget })
      if (next) onEditPlan?.(next)
    }
    const ex = buildExercise({ muscle, name, numSets, prevWeight: getLastW(name), prevReps: getSuggestedReps(name) })
    onUpdateActive(prev => ({ ...prev, exercises: [...prev.exercises, ex] }))
    setShowAdd(false)
  }

  const handleLoadRoutine = (routine) => {
    const exercises = routine.exercises.map(ex =>
      buildExercise({ muscle: ex.muscle, name: ex.name, numSets: ex.defaultSets || 3, prevWeight: getLastW(ex.name), prevReps: getSuggestedReps(ex.name) })
    )
    onUpdateActive(prev => ({ ...prev, exercises }))
    setShowRoutines(false)
  }

  const exercises = active.exercises || []
  const doneSets  = exercises.flatMap(ex => ex.sets).filter(s => s.done).length

  // What the swap sheet offers (src/plan/view.js rankAlternatives): the
  // same muscle first, then the same movement with another tool, never an
  // exercise already in the session; the session's own first exercise
  // back as «الأصلي» when this one is a swap. Allowed only while nothing
  // is logged, exactly as before; «دايماً بخطتي» only for a plan exercise.
  const swapOptions = (ex) => {
    const origin = ex.originalName && ex.originalName !== ex.name ? ex.originalName : null
    const others = exercises.filter(o => o.id !== ex.id).map(o => o.name)
    const alts = rankAlternatives(ex.name, {
      muscle: ex.muscle,
      exclude: [...others, ...(origin ? [origin] : [])],
      tried: (n) => engine.stats(n).lastWeight != null,   // his gym's machines first
    })
    const any = !!origin || alts.muscle.length + alts.tool.length > 0
    return {
      canSwap: any && !ex.sets.some(st => st.done),
      origin,
      alts,
      canAlways: !!onEditPlan && !!planRowOf(ex),
    }
  }

  const ytUrlFor = (name) => {
    const canon = resolveExerciseName(name, exerciseMapping)
    for (const group of Object.values(MUSCLE_GROUPS)) {
      const def = group.exercises?.find(e => e.name === name)
        || group.exercises?.find(e => e.name.toLowerCase() === canon)
      if (def?.videoUrl) return def.videoUrl
    }
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(name + ' proper form')}`
  }

  const discard = () => {
    setAskFinish(false)
    setAskDiscard(false)
    onCloseRest?.()
    onGoBack?.()
  }

  const lost = setsPhrase(doneSets)

  return (
    <div className="s-session" data-testid="session" data-own-bar={onMinimize ? '1' : undefined}>
      <SessionBar
        title={dayWord(active)}
        startedAt={active.id}
        onMinimize={onMinimize}
        onFinish={() => setAskFinish(true)}
      />

      {exercises.length === 0 ? (
        <>
          <div className="s-segs" aria-hidden="true"><span className="s-seg" /></div>
          <div className="s-scroll s-empty">
            <EmptyState
              icon={Barbell}
              title="جلسة فاضية"
              action={(
                <div className="s-empty-actions">
                  <Button variant="primary" size="lg" full icon={Plus} onClick={() => setShowAdd(true)}>أضف أول تمرين</Button>
                  <Button variant="secondary" size="lg" full icon={ListChecks} onClick={() => setShowRoutines(true)}>اختر روتين جاهز</Button>
                </div>
              )}
            >
              سجّل أول تمرين، والباقي تضيفه وأنت تتمرن.
            </EmptyState>
          </div>
        </>
      ) : (
        <WorkoutPlayer
          key={active.id}
          sessionId={active.id}
          exercises={exercises}
          deloadPct={active?.deload?.pct || 0}
          deloadStep={active?.deload?.ret ? 'ret' : active?.deload?.ramp ? 'ramp' : null}
          isResting={isResting}
          getLastW={getLastW}
          progressionFor={progressionFor}
          ytUrlFor={ytUrlFor}
          mapping={exerciseMapping}
          statsFor={engine.stats}
          previousFor={engine.previous}
          swapOptions={swapOptions}
          onUpdateSet={handleUpdateSet}
          onStepSet={handleStepSet}
          onDoneSet={handleDoneSet}
          onAddSet={handleAddSet}
          setAsk={setAsk}
          onSetAskAlways={handleSetAskAlways}
          onSetAskClose={() => showAsk(null)}
          onRemoveSet={handleRemoveSet}
          onRemoveEx={handleRemoveEx}
          onMoveSet={handleMoveSet}
          onSwapTo={handleSwapTo}
          onRotate={handleRotate}
          onOpenPlan={onOpenPlanView}
          onAddExercise={() => setShowAdd(true)}
          onRequestFinish={() => setAskFinish(true)}
          onDiscard={() => setAskDiscard(true)}
          onCloseRest={onCloseRest}
        />
      )}

      <FinishSheet
        open={askFinish}
        doneSets={doneSets}
        startedAt={active.id}
        onSave={() => { setAskFinish(false); onFinish() }}
        onDiscard={discard}
        onClose={() => setAskFinish(false)}
      />

      <ConfirmSheet
        open={askDiscard}
        onClose={() => setAskDiscard(false)}
        title="إلغاء التمرين؟"
        message={doneSets > 0
          ? <>تنحذف الجلسة كاملة بدون حفظ، ومعها {lost.num != null && <><Num>{lost.num}</Num> </>}{lost.word} سجّلتها. ما يمديك ترجعها.</>
          : 'تنحذف الجلسة كاملة بدون حفظ.'}
        confirmLabel="احذف الجلسة"
        cancelLabel="رجوع"
        destructive
        onConfirm={discard}
      />

      {showAdd      && <AddExerciseModal always={addAlways} onAdd={handleAddExercise} onClose={() => setShowAdd(false)} />}
      {showRoutines && <RoutinesModal onSelect={handleLoadRoutine} onClose={() => setShowRoutines(false)} />}
    </div>
  )
}
