import { useState, useEffect, useMemo } from 'react'
import { Button, ConfirmSheet, EmptyState, Num } from '../components/kit/index.jsx'
import { Barbell, Plus, ListChecks } from '../components/kit/icons.js'
import WorkoutPlayer from '../components/player/WorkoutPlayer.jsx'
import SessionBar from '../components/player/SessionBar.jsx'
import FinishSheet from '../components/player/FinishSheet.jsx'
import { dayWord, previousSets, setsPhrase } from '../components/player/sessionWords.js'
import AddExerciseModal from '../components/AddExerciseModal.jsx'
import RoutinesModal from '../components/RoutinesModal.jsx'
import { buildExercise, blankSet, getExerciseStats, substitutedName, nextSubIndex, suggestedWeightFor, markSetDone, resolveExerciseName } from '../utils.js'
import { deloadWeight } from '../deload.js'
import { MUSCLE_GROUPS, EXERCISE_ALTERNATIVES } from '../constants.js'
import { analyzeProgression, DEFAULT_REP_TARGET } from '../progression.js'
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

export default function WorkoutPage({
  active, sessions, onUpdateActive, onFinish, onShowRest, onCloseRest, addXP, onGoBack,
  onMinimize, isResting, exerciseMapping = {}, repTarget = DEFAULT_REP_TARGET,
  exerciseSubs = {}, onCycleSub,
}) {
  const [showAdd,       setShowAdd]       = useState(false)
  const [showRoutines,  setShowRoutines]  = useState(false)
  const [askFinish,     setAskFinish]     = useState(false)
  const [askDiscard,    setAskDiscard]    = useState(false)

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
      progression: (name) => memo('p', name, () => analyzeProgression(sessions, name, exerciseMapping, repTarget)),
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

  const handleDoneSet = (exId, si, done) => {
    if (done) {
      // XP still accrues per set, silently: no toast, no flying number.
      // The set's own row says it is done; a personal best is said on
      // that row in gold.
      if (addXP) addXP(10)
      onShowRest()
    }
    // Marking done also carries the numbers into the blank sets that
    // follow — see markSetDone for why and for what it refuses to touch.
    updateEx(exId, ex => ({ ...ex, sets: markSetDone(ex.sets, si, done) }))
  }

  const handleAddSet = (exId) =>
    updateEx(exId, ex => {
      const prev = ex.sets.at(-1)?.weight || ''
      const prevReps = ex.sets[ex.sets.length - 1]?.reps || ''
      return { ...ex, sets: [...ex.sets, blankSet(prev, prevReps)] }
    })

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

  const getSuggestedReps = (name) => engine.progression(name).suggestedReps

  // Progression is frozen for the length of a deload. The weights are
  // deliberately low, so "add weight" would be wrong and "drop the
  // weight" would be advice about a decline that was the plan.
  const progressionFor = (name) => {
    const p = engine.progression(name)
    return active?.deload ? { ...p, hint: null } : p
  }

  // Swap a machine mid-workout when it turns out to be occupied. Only
  // offered while nothing is logged yet, so completed sets are never
  // re-attributed to a different exercise.
  const handleSwapLive = (exId) => {
    const ex = exercises.find(e => e.id === exId)
    if (!ex) return
    const origin = ex.originalName || ex.name
    const nextIdx = nextSubIndex(origin, exerciseSubs, EXERCISE_ALTERNATIVES)
    const nextName = substitutedName(origin, { ...exerciseSubs, [origin]: nextIdx }, EXERCISE_ALTERNATIVES)
    onCycleSub?.(origin, nextIdx)   // remember it for next time too
    updateEx(exId, e => ({
      ...e,
      name: nextName,
      originalName: origin,
      // the new machine carries its own load history
      sets: e.sets.map(() => blankSet(getLastW(nextName), getSuggestedReps(nextName))),
    }))
  }

  const handleAddExercise = ({ muscle, name, numSets }) => {
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

  // What the ⋯ menu needs to know about swapping: allowed only while
  // nothing is logged, exactly as before. It names the machine the swap
  // leads to (null: back to the original); the menu words it, Arabic first.
  const swapMeta = (ex) => {
    const origin = ex.originalName || ex.name
    const alts = EXERCISE_ALTERNATIVES[origin] || []
    const subIdx = exerciseSubs[origin] || 0
    return {
      canSwap: alts.length > 0 && !ex.sets.some(st => st.done),
      next: subIdx < alts.length ? alts[subIdx] : null,
      origin,
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
          sessionId={active.id}
          exercises={exercises}
          deloadPct={active?.deload?.pct || 0}
          isResting={isResting}
          getLastW={getLastW}
          progressionFor={progressionFor}
          ytUrlFor={ytUrlFor}
          mapping={exerciseMapping}
          statsFor={engine.stats}
          previousFor={engine.previous}
          swapMeta={swapMeta}
          onUpdateSet={handleUpdateSet}
          onStepSet={handleStepSet}
          onDoneSet={handleDoneSet}
          onAddSet={handleAddSet}
          onRemoveSet={handleRemoveSet}
          onRemoveEx={handleRemoveEx}
          onMoveSet={handleMoveSet}
          onSwap={handleSwapLive}
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

      {showAdd      && <AddExerciseModal onAdd={handleAddExercise} onClose={() => setShowAdd(false)} />}
      {showRoutines && <RoutinesModal onSelect={handleLoadRoutine} onClose={() => setShowRoutines(false)} />}
    </div>
  )
}
