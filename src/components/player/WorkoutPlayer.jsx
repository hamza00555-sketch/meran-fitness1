import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Num } from '../kit/index.jsx'
import { Check, CaretLeft, CheckCircle, ArrowUp } from '../kit/icons.js'
import ExerciseHero from './ExerciseHero.jsx'
import WorkingArea from './WorkingArea.jsx'
import SetHistory from './SetHistory.jsx'
import ExerciseQueue from './ExerciseQueue.jsx'
import InlineRest from './InlineRest.jsx'
import { primeAudio } from './sessionAudio.js'
import { kg, setLabel, setsPhrase } from './sessionWords.js'
import { arabicName } from '../../exerciseMedia.js'
import { PLATE_STEP, roundToPlate } from '../../utils.js'

// ── Session mode: the workout player ──────────────────────────
//
// One exercise on screen, top to bottom: a 4px segmented progress bar
// (one segment per exercise), the exercise head (a lit stage before the
// first set, a 72pt row after it), the sets table whose active row is
// the live block, and the rest of the session as a list. Under it all,
// docked at the bottom, the one green action — «تمّت المجموعة» — which
// the rest takes over in place while you rest.
//
// The exercise on screen is the only one with a live block, which is
// the old focus rule made structural: a weight typed now can only land
// on the exercise you are looking at. Moving between exercises is a tap
// in the list or a swipe on the head; it never completes, clears or
// reorders anything.

// The raise prefill happens once per exercise per session: after that
// the numbers are the lifter's, including a «خلّها 75». Kept in
// sessionStorage (tab-scoped, nothing the stored data or the old design
// ever sees) so a reload doesn't put back a weight he declined.
const RAISE_KEY = 'meran_raise_applied'
const raiseSeen = (key) => {
  try { return JSON.parse(sessionStorage.getItem(RAISE_KEY) || '[]').includes(key) } catch { return false }
}
const markRaiseSeen = (key) => {
  try {
    const list = JSON.parse(sessionStorage.getItem(RAISE_KEY) || '[]')
    if (!list.includes(key)) sessionStorage.setItem(RAISE_KEY, JSON.stringify([...list, key].slice(-60)))
  } catch {}
}

const firstUnfinished = (list, from = 0) => {
  const n = list.length
  for (let k = 0; k < n; k++) {
    const i = (from + k) % n
    const e = list[i]
    if (e.sets.length && !e.sets.every(s => s.done)) return i
  }
  return -1
}

function coachFor({ prog, prevSet, lastWeight, raisedW, deloadPct }) {
  const t = prog?.target
  const last = setLabel(prevSet)
  const lead = last ? <>آخر مرة <Num>{last}</Num></>
    : lastWeight != null ? <>آخر مرة <Num>{kg(lastWeight)}</Num> كجم</>
    : <>أول مرة</>
  if (deloadPct > 0) return <>{lead} — ديلود، أخف بـ<Num>{deloadPct}%</Num></>
  switch (prog?.hint) {
    case 'raise':
      return raisedW != null ? <>{lead} — جرّب <Num>{kg(raisedW)}</Num></> : lead
    case 'lower':
      return prog.suggestedWeight != null
        ? <>{lead} — خفّف إلى <Num>{kg(prog.suggestedWeight)}</Num></>
        : <>{lead} — خفّف الوزن شوي</>
    case 'push':
      return t ? <>{lead} — حاول توصل <Num>{t.top}</Num> عدّة</> : lead
    default:
      return t ? <>{lead} — الهدف <Num>{t.base}–{t.top}</Num> عدّة</> : lead
  }
}

export default function WorkoutPlayer({
  sessionId, exercises,
  deloadPct = 0, isResting,
  getLastW, progressionFor, ytUrlFor, statsFor, previousFor = () => [], swapMeta,
  onUpdateSet, onStepSet, onDoneSet, onAddSet, onRemoveSet, onRemoveEx, onMoveSet, onSwap,
  onAddExercise, onRequestFinish, onDiscard, onCloseRest,
}) {
  const [index, setIndex] = useState(() => Math.max(0, firstUnfinished(exercises)))
  const [editingSet, setEditingSet] = useState(null)   // { exId, si }
  const [celebrating, setCelebrating] = useState(null) // { exId }
  const [peek, setPeek] = useState(null)               // ex id whose stage was reopened
  const [fresh, setFresh] = useState(null)             // { exId, si } — the check to draw
  const celebratedRef = useRef(new Set())
  const ringStart = useRef(new Map())
  const scrollRef = useRef(null)

  const safeIndex = Math.min(index, Math.max(0, exercises.length - 1))
  const ex = exercises[safeIndex]

  const jump = (i) => {
    if (i < 0 || i >= exercises.length) return
    setIndex(i)
    setEditingSet(null)
    setPeek(null)
    setFresh(null)
    scrollRef.current?.scrollTo?.({ top: 0 })
  }

  // The set being worked: the first unticked one.
  const currentSetIndex = ex ? ex.sets.findIndex(s => !s.done) : -1
  const exComplete = !!ex && ex.sets.length > 0 && currentSetIndex === -1
  const editing = editingSet && editingSet.exId === ex?.id && ex.sets[editingSet.si] ? editingSet.si : null
  const liveIndex = editing != null ? editing : currentSetIndex

  // Completing an exercise's last set earns a short line — what was
  // done, whether it beat last time — then the next unfinished exercise
  // comes on screen by itself (during the rest, which is when its demo
  // can actually be watched). Once per exercise per session.
  useEffect(() => {
    if (!ex || !exComplete || celebratedRef.current.has(ex.id)) return
    celebratedRef.current.add(ex.id)
    setCelebrating({ exId: ex.id })
  }, [exComplete, ex?.id])

  // The celebration owns its own lifetime, keyed on itself — never on
  // the exercise on screen, or moving away mid-line would cancel the
  // timer and leave it up for good.
  const exercisesRef = useRef(exercises)
  exercisesRef.current = exercises
  useEffect(() => {
    if (!celebrating) return
    const t = setTimeout(() => {
      setCelebrating(null)
      const list = exercisesRef.current
      const at = list.findIndex(e => e.id === celebrating.exId)
      const next = firstUnfinished(list, at + 1)
      if (next !== -1) jump(next)
    }, 1600)
    return () => clearTimeout(t)
  }, [celebrating?.exId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the live block in view as sets go by.
  useEffect(() => {
    const el = scrollRef.current?.querySelector('[data-testid="live-block"]')
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [ex?.id, liveIndex])

  // ── The exercise on screen ──
  const prog = ex ? progressionFor(ex.name) : null
  const stats = ex ? statsFor(ex.name) : { lastWeight: null, maxWeight: null }
  const prevSets = useMemo(() => (ex ? previousFor(ex.name) : []), [ex?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  // RAISE: the engine said add weight (it is silent during a deload).
  // The new number is last + one plate step, computed here.
  const raiseOn = !!ex && prog?.hint === 'raise'
  const snapW = ex ? parseFloat(getLastW(ex.name)) : NaN
  const base = raiseOn
    ? (prog.workingWeight ?? (Number.isFinite(snapW) ? snapW : null))
    : null
  const raisedW = base != null ? roundToPlate(base + PLATE_STEP) : null

  // Prefill once: every set still to do that holds the old weight now
  // holds the new one, so set 2 doesn't fall back to 75.
  useEffect(() => {
    if (!ex || !raiseOn || base == null || raisedW == null) return
    if (ex.sets.some(s => s.done)) return
    const key = `${sessionId}:${ex.id}`
    if (raiseSeen(key)) return
    markRaiseSeen(key)
    ex.sets.forEach((s, i) => {
      if (s.done) return
      const w = parseFloat(s.weight)
      if (String(s.weight ?? '').trim() === '' || w === base || w === snapW) {
        onUpdateSet(ex.id, i, 'weight', kg(raisedW))
      }
    })
  }, [ex?.id, raiseOn, base]) // eslint-disable-line react-hooks/exhaustive-deps

  const keepBase = () => {
    if (!ex || base == null) return
    ex.sets.forEach((s, i) => {
      if (!s.done && parseFloat(s.weight) !== base) onUpdateSet(ex.id, i, 'weight', kg(base))
    })
  }

  // The ring is drawn once per exercise: the first time it shows, and
  // for the length of that one drawing; after that it is simply there.
  const liveSet = ex && liveIndex >= 0 ? ex.sets[liveIndex] : null
  const liveRaised = raiseOn && base != null && liveSet && parseFloat(liveSet.weight) > base
  if (liveRaised && ex && !ringStart.current.has(ex.id)) ringStart.current.set(ex.id, Date.now())
  const ringDraw = !!ex && ringStart.current.has(ex.id) && Date.now() - ringStart.current.get(ex.id) < 1400

  // A set heavier than anything on record: the heaviest such done set.
  const prIndex = useMemo(() => {
    if (!ex || deloadPct > 0 || stats.maxWeight == null) return null
    let best = null, bestW = stats.maxWeight
    ex.sets.forEach((s, i) => {
      const w = parseFloat(s.weight)
      if (s.done && w > bestW) { best = i; bestW = w }
    })
    return best
  }, [ex, stats.maxWeight, deloadPct])

  const summary = useMemo(() => {
    if (!ex || !exComplete) return null
    const weights = ex.sets.filter(s => s.done).map(s => parseFloat(s.weight)).filter(w => w > 0)
    const top = weights.length ? Math.max(...weights) : null
    const delta = top != null && stats.lastWeight != null ? Math.round((top - stats.lastWeight) * 10) / 10 : null
    return { sets: ex.sets.filter(s => s.done).length, top, delta }
  }, [ex, exComplete, stats.lastWeight])

  if (!ex) return null

  const complete = () => {
    if (currentSetIndex < 0) return
    primeAudio()
    setPeek(null)
    setFresh({ exId: ex.id, si: currentSetIndex })
    onDoneSet(ex.id, currentSetIndex, true)
  }

  const hasDone = ex.sets.some(s => s.done)
  const expanded = !hasDone || peek === ex.id
  const nextIdx = firstUnfinished(exercises, safeIndex + 1)
  const meta = swapMeta(ex)
  const ar = arabicName(ex.name)

  const live = liveIndex >= 0 ? (
    <WorkingArea
      ex={ex} setIndex={liveIndex} editing={editing != null}
      prevSet={prevSets[liveIndex] || null}
      coach={editing != null ? null : coachFor({
        prog, prevSet: prevSets[liveIndex] || prevSets[prevSets.length - 1] || null,
        lastWeight: stats.lastWeight ?? (deloadPct === 0 && Number.isFinite(snapW) && snapW > 0 ? snapW : null),
        raisedW, deloadPct,
      })}
      raise={raiseOn && base != null && editing == null ? { base, raised: raisedW, ringDraw } : null}
      onUpdateSet={(si, f, v) => onUpdateSet(ex.id, si, f, v)}
      onStepSet={(si, f, d) => onStepSet(ex.id, si, f, d)}
      onKeepBase={keepBase}
    />
  ) : null

  // ── The dock: one green action, or the rest in its place ──
  let dock = null
  if (editing != null) {
    dock = <Button variant="primary" size="lg" full icon={Check} onClick={() => setEditingSet(null)}>حفظ التعديل</Button>
  } else if (isResting) {
    dock = null   // InlineRest below
  } else if (currentSetIndex >= 0) {
    dock = <Button variant="primary" size="lg" full icon={Check} onClick={complete} data-testid="complete-set">تمّت المجموعة</Button>
  } else if (nextIdx !== -1) {
    dock = <Button variant="primary" size="lg" full icon={CaretLeft} onClick={() => jump(nextIdx)}>التمرين التالي</Button>
  } else {
    dock = <Button variant="primary" size="lg" full icon={Check} onClick={onRequestFinish}>إنهاء الجلسة</Button>
  }
  const restOnTop = isResting && editing == null

  const phrase = summary ? setsPhrase(summary.sets) : null

  return (
    <>
      {/* ── One segment per exercise, filled by its done sets ── */}
      <div className="s-segs" role="progressbar" aria-label="تقدّم الجلسة"
        aria-valuemin={0} aria-valuemax={exercises.length}
        aria-valuenow={exercises.filter(e => e.sets.length && e.sets.every(s => s.done)).length}>
        {exercises.map((e, i) => {
          const done = e.sets.filter(s => s.done).length
          const frac = e.sets.length ? done / e.sets.length : 0
          return (
            <span key={e.id} className="s-seg" data-on={i === safeIndex ? '1' : undefined}>
              <i style={{ transform: `scaleX(${frac})` }} />
            </span>
          )
        })}
      </div>

      <div className="s-scroll" ref={scrollRef}>
        <ExerciseHero
          ex={ex}
          expanded={expanded}
          collapsible={hasDone && peek === ex.id}
          animate
          onToggleStage={() => setPeek(p => (p === ex.id ? null : ex.id))}
          maxWeight={stats.maxWeight}
          quietBest={raiseOn}
          deloadPct={deloadPct}
          ytUrl={ytUrlFor(ex.name)}
          canSwap={meta.canSwap}
          swapTitle={meta.title}
          onSwap={() => onSwap(ex.id)}
          onRemove={() => onRemoveEx(ex.id)}
          onAddSet={() => onAddSet(ex.id)}
          onRemoveSet={() => onRemoveSet(ex.id, ex.sets.length - 1)}
          onMoveSet={(toId) => onMoveSet(ex.id, ex.sets.length - 1, toId)}
          moveTargets={exercises.filter(o => o.id !== ex.id).map(o => ({ id: o.id, name: o.name }))}
          onAddExercise={onAddExercise}
          onDiscard={onDiscard}
          onSwipe={(dir) => jump(Math.max(0, Math.min(exercises.length - 1, safeIndex + dir)))}
        />

        {ex.sets.length > 0 ? (
          <SetHistory
            ex={ex}
            liveIndex={liveIndex}
            currentIndex={currentSetIndex}
            editingIndex={editing}
            prevSets={prevSets}
            freshIndex={fresh && fresh.exId === ex.id ? fresh.si : null}
            prIndex={prIndex}
            onEdit={(si) => setEditingSet(cur => (cur && cur.exId === ex.id && cur.si === si ? null : { exId: ex.id, si }))}
            live={live}
          />
        ) : (
          <p className="s-note">ما فيه مجموعات — أضف مجموعة من <span aria-hidden="true">⋯</span>.</p>
        )}

        {exComplete && editing == null && summary && (
          <div className="s-done-line" data-testid="exercise-done" role="status">
            <CheckCircle size={22} weight="fill" className="s-done-icon" aria-hidden="true" />
            <div className="s-done-text">
              <strong>{celebrating?.exId === ex.id ? `اكتمل ${ar || ex.name}` : 'اكتمل هذا التمرين'}</strong>
              <span>
                {phrase.num != null && <><Num>{phrase.num}</Num> </>}{phrase.word}
                {summary.top != null && <> · أعلى <Num>{kg(summary.top)}</Num> كجم</>}
                {summary.delta > 0 && (
                  <span className="s-done-delta">
                    {' · '}<ArrowUp size={14} weight="bold" aria-hidden="true" /><Num>+{kg(summary.delta)}</Num> عن آخر مرة
                  </span>
                )}
              </span>
            </div>
          </div>
        )}

        <ExerciseQueue
          exercises={exercises}
          activeIndex={safeIndex}
          onJump={jump}
          onAdd={onAddExercise}
        />
      </div>

      <div className="s-dock" data-mode={restOnTop ? 'rest' : 'button'}>
        {isResting && (
          <InlineRest onDone={onCloseRest} onSkip={onCloseRest} hidden={!restOnTop} />
        )}
        {dock}
      </div>
    </>
  )
}
