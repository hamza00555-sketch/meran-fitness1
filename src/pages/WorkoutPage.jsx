import { useState, useEffect, useRef } from 'react'
import Art from '../assets/Art.jsx'
import { EmptyState, Card, Badge, SectionTitle } from '../components/ui.jsx'
import ExerciseCard, { PRFlash } from '../components/ExerciseCard.jsx'
import WorkoutPlayer from '../components/player/WorkoutPlayer.jsx'
import AddExerciseModal from '../components/AddExerciseModal.jsx'
import RoutinesModal from '../components/RoutinesModal.jsx'
import { buildExercise, blankSet, fmtDate, fmtDuration, sessionVolume, getHistoricalMax, getExerciseStats, resolveExerciseName, substitutedName, nextSubIndex, suggestedWeightFor, markSetDone, planDayType, ls } from '../utils.js'
import { deloadWeight } from '../deload.js'
import { MUSCLE_GROUPS, ROUTINES, EXERCISE_ALTERNATIVES } from '../constants.js'
import { analyzeProgression, DEFAULT_REP_TARGET } from '../progression.js'
import { toWesternDigits } from '../day.js'

export default function WorkoutPage({ active, sessions, onUpdateActive, onFinish, onShowRest, onCloseRest, addXP, onGoBack, isResting, exerciseMapping = {}, repTarget = DEFAULT_REP_TARGET, exerciseSubs = {}, onCycleSub, onUpdateSession, onDeleteSession }) {
  const [showAdd,       setShowAdd]       = useState(false)
  const [showRoutines,  setShowRoutines]  = useState(false)
  const [elapsed,       setElapsed]       = useState(0)
  const [confirmBack,   setConfirmBack]   = useState(false)
  const [showPR,        setShowPR]        = useState(null)
  const [focusExId,     setFocusExId]     = useState(null)
  const timerRef      = useRef(null)
  const pausedMsRef   = useRef(0)
  const pauseStartRef = useRef(null)

  // pause timer when rest opens, resume when it closes
  useEffect(() => {
    if (!active) return
    if (isResting) {
      clearInterval(timerRef.current)
      pauseStartRef.current = Date.now()
    } else {
      if (pauseStartRef.current) {
        pausedMsRef.current += Date.now() - pauseStartRef.current
        pauseStartRef.current = null
      }
      const tick = () => setElapsed(Math.floor((Date.now() - active.id - pausedMsRef.current) / 1000))
      tick()
      timerRef.current = setInterval(tick, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [active?.id, isResting])

  // ── History View ─────────────────────────────────────────────
  // The history is its own tab now (HistoryPage); this page only runs
  // the session, inside the full-screen cover.
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

  const handleDoneSet = (exId, si, done) => {
    if (done) {
      const ex  = exercises.find(e => e.id === exId)
      const set = ex?.sets[si]
      // The PR celebration used to be raised inside ExerciseCard; the
      // player calls this handler directly, so the check lives here now
      // and fires for both surfaces. Same rules: heavier than every
      // recorded lift, and never during a deload.
      if (ex && set && !active?.deload) {
        const { maxWeight } = getExerciseStats(sessions, ex.name, exerciseMapping)
        const w = parseFloat(set.weight) || 0
        if (maxWeight != null && w > maxWeight) {
          setShowPR({ weight: w, prev: maxWeight, name: ex.name })
          setTimeout(() => setShowPR(null), 2200)
        }
      }
      if (addXP) addXP(10, '✓ سيت مكتمل')
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

  const getSuggestedReps = (name) =>
    analyzeProgression(sessions, name, exerciseMapping, repTarget).suggestedReps

  // Progression is frozen for the length of a deload. The weights are
  // deliberately low, so "add weight" would be wrong and "drop the
  // weight" would be advice about a decline that was the plan. The
  // engine still runs — its reading of the working weight is needed
  // for the reps box — but it offers no verdict.
  const progressionFor = (name) => {
    const p = analyzeProgression(sessions, name, exerciseMapping, repTarget)
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
  const allSets   = exercises.flatMap(ex => ex.sets)
  const doneSets  = allSets.filter(s => s.done).length
  const totalSets = allSets.length

  const fmtElapsed = (secs) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  const pct = totalSets > 0 ? (doneSets / totalSets) * 100 : 0

  // Active exercise = the one the user last interacted with (typed a
  // weight/rep, ticked a set, added a set). Others dim until either
  // this one is fully done or the user taps/edits another card —
  // supports jumping between machines when the gym is crowded.
  const focusedEx = exercises.find(e => e.id === focusExId)
  const focusStillActive = focusedEx && focusedEx.sets.length > 0 && !focusedEx.sets.every(s => s.done)
  const activeExId = focusStillActive ? focusExId : null

  // What the ⋯ menu needs to know about swapping: allowed only while
  // nothing is logged, exactly as before.
  const swapMeta = (ex) => {
    const origin = ex.originalName || ex.name
    const alts = EXERCISE_ALTERNATIVES[origin] || []
    const subIdx = exerciseSubs[origin] || 0
    return {
      canSwap: alts.length > 0 && !ex.sets.some(st => st.done),
      title: subIdx < alts.length ? `التالي: ${alts[subIdx]}` : 'رجوع للتمرين الأصلي',
    }
  }

  const ytUrlFor = (name) => {
    for (const group of Object.values(MUSCLE_GROUPS)) {
      const def = group.exercises?.find(e => e.name === name)
      if (def?.videoUrl) return def.videoUrl
    }
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(name + ' proper form')}`
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      {exercises.length === 0 ? (
        <div style={{ paddingTop: 40 }}>
          <EmptyState
            art="empty_workout"
            title="جلسة فارغة"
            desc="أضف أول تمرين وابدأ التسجيل"
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn-cyan" style={{ flex: 1 }} onClick={() => setShowAdd(true)}>＋ أضف أول تمرين</button>
            <button onClick={() => setShowRoutines(true)} style={{
              padding: '0 16px', background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 12, color: 'var(--text2)', fontFamily: 'var(--font-ar)', fontSize: 13, cursor: 'pointer',
            }}>📋 روتين جاهز</button>
          </div>
        </div>
      ) : (
        <WorkoutPlayer
          exercises={exercises}
          sessionName={active.name || 'جلسة تمرين'}
          elapsedLabel={fmtElapsed(elapsed)}
          doneSets={doneSets}
          totalSets={totalSets}
          pct={pct}
          deloadPct={active?.deload?.pct || 0}
          isResting={isResting}
          getLastW={getLastW}
          getSuggested={getLastW}
          progressionFor={progressionFor}
          ytUrlFor={ytUrlFor}
          statsFor={(name) => getExerciseStats(sessions, name, exerciseMapping)}
          swapMeta={swapMeta}
          onUpdateSet={handleUpdateSet}
          onDoneSet={handleDoneSet}
          onAddSet={handleAddSet}
          onRemoveSet={handleRemoveSet}
          onRemoveEx={handleRemoveEx}
          onMoveSet={handleMoveSet}
          onSwap={handleSwapLive}
          onAddExercise={() => setShowAdd(true)}
          onFinish={onFinish}
          onBack={() => setConfirmBack(true)}
          onCloseRest={onCloseRest}
        />
      )}

      {showPR && <PRFlash
        color={MUSCLE_GROUPS[exercises.find(e => e.name === showPR.name)?.muscle]?.color || 'var(--cyan)'}
        weight={showPR.weight} prev={showPR.prev} exerciseName={showPR.name}
      />}

      {showAdd      && <AddExerciseModal onAdd={handleAddExercise} onClose={() => setShowAdd(false)} />}
      {showRoutines && <RoutinesModal onSelect={handleLoadRoutine} onClose={() => setShowRoutines(false)} />}

      {confirmBack && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }} onClick={() => setConfirmBack(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg2)', borderRadius: 20, padding: 24, maxWidth: 320, width: '100%',
            border: '1px solid var(--border)',
          }}>
            <p style={{ fontFamily: 'var(--font-ar)', fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8, textAlign: 'center' }}>
              تأكيد الخروج
            </p>
            <p style={{ fontFamily: 'var(--font-ar)', fontSize: 14, color: 'var(--text2)', textAlign: 'center', marginBottom: 20 }}>
              سيتم فقدان التمرين الحالي. هل أنت متأكد؟
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmBack(false)} style={{
                flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '12px', color: 'var(--text2)',
                fontFamily: 'var(--font-ar)', fontSize: 14, cursor: 'pointer',
              }}>إلغاء</button>
              <button onClick={() => { setConfirmBack(false); onGoBack() }} style={{
                flex: 1, background: '#EF4444', border: 'none',
                borderRadius: 12, padding: '12px', color: 'white',
                fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>خروج</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
