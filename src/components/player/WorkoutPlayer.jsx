import { useEffect, useMemo, useRef, useState } from 'react'
import ExerciseHero from './ExerciseHero.jsx'
import WorkingArea from './WorkingArea.jsx'
import SetHistory from './SetHistory.jsx'
import ExerciseQueue from './ExerciseQueue.jsx'
import InlineRest from './InlineRest.jsx'
import { toWesternDigits } from '../../day.js'
import { getExerciseStats } from '../../utils.js'

// ── The workout player ────────────────────────────────────────
//
// The session as a flow instead of a list. One exercise fills the
// screen; the rest peek from the edges and wait their turn. Only the
// exercise on screen has a working area at all, which is the old
// focus/dimming rule made structural: logging a weight into the wrong
// exercise now requires the wrong exercise to be on screen.
//
// Swiping is navigation and nothing else. It never completes, never
// clears, never reorders — the only state it touches is which slide
// is centred.

const useSnapIndex = (count) => {
  const trackRef = useRef(null)
  const [index, setIndex] = useState(0)
  const indexRef = useRef(0)

  // The centred child is the active one. Measured from geometry rather
  // than scrollLeft, because scrollLeft's sign in RTL differs between
  // engines and geometry doesn't lie in either direction.
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    let raf = 0
    const measure = () => {
      raf = 0
      const mid = el.getBoundingClientRect().left + el.clientWidth / 2
      let best = 0, bestDist = Infinity
      for (let i = 0; i < el.children.length; i++) {
        const r = el.children[i].getBoundingClientRect()
        const d = Math.abs(r.left + r.width / 2 - mid)
        if (d < bestDist) { bestDist = d; best = i }
      }
      if (best !== indexRef.current) {
        indexRef.current = best
        setIndex(best)
        if (navigator.vibrate) navigator.vibrate(8)
      }
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure) }
    el.addEventListener('scroll', onScroll, { passive: true })
    measure()
    return () => { el.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [count])

  const jump = (i, smooth = true) => {
    const el = trackRef.current
    const child = el?.children[i]
    if (child) child.scrollIntoView({ inline: 'center', block: 'nearest', behavior: smooth ? 'smooth' : 'instant' })
  }

  return { trackRef, index, jump }
}

export default function WorkoutPlayer({
  exercises, sessionName, elapsedLabel, doneSets, totalSets, pct,
  deloadPct = 0, isResting,
  getLastW, getSuggested, progressionFor, ytUrlFor, statsFor, swapMeta,
  onUpdateSet, onDoneSet, onAddSet, onRemoveSet, onRemoveEx, onMoveSet, onSwap,
  onAddExercise, onFinish, onBack, onCloseRest,
}) {
  const { trackRef, index, jump } = useSnapIndex(exercises.length)
  const [editingSet, setEditingSet] = useState(null)   // { exId, si }
  const [celebrating, setCelebrating] = useState(null) // { exId } — the exercise that just finished
  const celebratedRef = useRef(new Set())

  const ex = exercises[Math.min(index, exercises.length - 1)]

  // The set being worked: the first unticked one.
  const currentSetIndex = ex ? ex.sets.findIndex(s => !s.done) : -1
  const exComplete = ex && ex.sets.length > 0 && currentSetIndex === -1

  const editing = editingSet && editingSet.exId === ex?.id ? editingSet.si : null

  // Completing the last set of an exercise earns a short transition —
  // what happened, and whether it beat last session — then the carousel
  // moves itself to the next unfinished exercise. Once per exercise per
  // session, so re-editing a set never re-celebrates.
  useEffect(() => {
    if (!ex || !exComplete || celebratedRef.current.has(ex.id)) return
    celebratedRef.current.add(ex.id)
    setCelebrating({ exId: ex.id })
    const t = setTimeout(() => {
      setCelebrating(null)
      const next = exercises.findIndex(e => e.sets.length && !e.sets.every(s => s.done))
      if (next !== -1) jump(next)
    }, 1600)
    return () => clearTimeout(t)
  }, [exComplete, ex?.id])

  // Numbers for the transition card, computed only while it shows.
  const summary = useMemo(() => {
    if (!celebrating) return null
    const done = exercises.find(e => e.id === celebrating.exId)
    if (!done) return null
    const weights = done.sets.map(s => parseFloat(s.weight)).filter(w => w > 0)
    const top = weights.length ? Math.max(...weights) : null
    const { lastWeight } = statsFor(done.name)
    const delta = top != null && lastWeight != null ? Math.round((top - lastWeight) * 10) / 10 : null
    return { name: done.name, sets: done.sets.length, top, delta }
  }, [celebrating])

  if (!ex) return null

  const prog = progressionFor(ex.name)

  return (
    <div style={{ paddingBottom: 24 }}>

      {/* ── Session header: timer · name · position, then progress ── */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 800,
            color: 'var(--cyan)', fontVariantNumeric: 'tabular-nums', flexShrink: 0,
          }}>⏱ {elapsedLabel}</span>
          <span style={{
            flex: 1, textAlign: 'center', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 800, color: 'var(--text)',
          }}>{sessionName}</span>
          <span style={{
            fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', flexShrink: 0,
          }}>{toWesternDigits(index + 1)} من {toWesternDigits(exercises.length)}</span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: 'var(--bg3)', overflow: 'hidden', marginBottom: 6 }}>
          <div style={{
            height: '100%', width: `${pct}%`, borderRadius: 2,
            background: pct >= 100 ? '#22C55E' : 'var(--cyan)',
            transition: 'width 0.4s ease',
          }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onFinish} style={{
            background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer',
            fontFamily: 'var(--font-ar)', fontSize: 13, fontWeight: 800, color: 'var(--red)',
          }}>⏻ إنهاء التمرين</button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
            sets {toWesternDigits(doneSets)}/{toWesternDigits(totalSets)}
          </span>
          {deloadPct > 0 && (
            <span style={{
              marginInlineStart: 'auto',
              background: 'var(--cyan-lo)', border: '1px solid var(--cyan-md)',
              borderRadius: 20, padding: '2px 10px',
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 800, color: 'var(--cyan)',
            }}>DELOAD · −{deloadPct}%</span>
          )}
          <button onClick={onBack} style={{
            marginInlineStart: deloadPct > 0 ? 0 : 'auto',
            background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer',
            fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)',
          }}>← تراجع</button>
        </div>
      </div>

      {/* ── The carousel ── */}
      <div
        ref={trackRef}
        style={{
          display: 'flex', gap: 10,
          overflowX: 'auto', scrollSnapType: 'x mandatory',
          padding: '2px 2px 6px',
          scrollbarWidth: 'none',
          // The 88% slide is what makes the neighbours peek; bleeding
          // past the page padding looked nicer but inflated the
          // document's scroll width on small screens.
        }}
      >
        {exercises.map((e, i) => {
          const stats = statsFor(e.name)
          const meta = swapMeta(e)
          return (
            <div key={e.id} style={{ flex: '0 0 88%', scrollSnapAlign: 'center', minWidth: 0 }}>
              <ExerciseHero
                ex={e}
                ytUrl={ytUrlFor(e.name)}
                progression={i === index ? prog : null}
                lastWeight={stats.lastWeight}
                maxWeight={stats.maxWeight}
                isComplete={e.sets.length > 0 && e.sets.every(s => s.done)}
                deloadPct={deloadPct}
                isActive={i === index}
                canSwap={meta.canSwap}
                swapTitle={meta.title}
                onSwap={() => onSwap(e.id)}
                onRemove={() => onRemoveEx(e.id)}
                onAddSet={() => onAddSet(e.id)}
                onRemoveSet={() => onRemoveSet(e.id, e.sets.length - 1)}
                onMoveSet={(toId) => onMoveSet(e.id, e.sets.length - 1, toId)}
                moveTargets={exercises.filter(o => o.id !== e.id).map(o => ({ id: o.id, name: o.name }))}
              />
            </div>
          )
        })}
      </div>

      {/* ── The working area for the exercise on screen ──
          minmax(0,1fr): a grid's auto column refuses to shrink below
          its widest item's min-content, and one stubborn intrinsic
          width (a mono input, a long exercise name) would push the
          whole column past a small phone. Zero-basis makes the column
          obey the page and lets each card solve its own overflow. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10, marginTop: 10 }}>
        {celebrating && summary ? (
          <div style={{
            background: 'var(--bg2)', border: '1px solid #22C55E50',
            borderRadius: 'var(--radius)', padding: 20, textAlign: 'center',
            animation: 'scaleIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 18, fontWeight: 900, color: '#22C55E' }}>
              {summary.name} مكتمل ✓
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text2)', marginTop: 6 }}>
              {toWesternDigits(summary.sets)} sets{summary.top != null && <> · {summary.top}kg</>}
            </div>
            {summary.delta > 0 && (
              <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--gold)', marginTop: 4, fontWeight: 700 }}>
                ⬆️ ‎+{summary.delta}kg عن الجلسة الماضية
              </div>
            )}
          </div>
        ) : editing != null ? (
          <WorkingArea
            ex={ex} setIndex={editing} editing
            lastWeight={statsFor(ex.name).lastWeight}
            suggested={getSuggested(ex.name)}
            target={prog?.target}
            onUpdateSet={(si, f, v) => onUpdateSet(ex.id, si, f, v)}
            onStepWeight={(si, d) => onUpdateSet(ex.id, si, 'weight', String(Math.max(0, Math.round(((parseFloat(ex.sets[si]?.weight) || 0) + d) * 10) / 10)))}
            onStepReps={(si, d) => onUpdateSet(ex.id, si, 'reps', String(Math.max(0, (parseInt(ex.sets[si]?.reps) || 0) + d)))}
            onDoneEditing={() => setEditingSet(null)}
          />
        ) : isResting ? (
          <InlineRest onDone={onCloseRest} onSkip={onCloseRest} />
        ) : exComplete ? (
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: 16, textAlign: 'center',
            fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)',
          }}>
            هذا التمرين مكتمل ✓ — اسحب للتمرين التالي أو عدّل مجموعة سابقة من القائمة تحت
          </div>
        ) : (
          <WorkingArea
            ex={ex} setIndex={currentSetIndex}
            lastWeight={statsFor(ex.name).lastWeight}
            suggested={getSuggested(ex.name)}
            target={prog?.target}
            onUpdateSet={(si, f, v) => onUpdateSet(ex.id, si, f, v)}
            onStepWeight={(si, d) => onUpdateSet(ex.id, si, 'weight', String(Math.max(0, Math.round(((parseFloat(ex.sets[si]?.weight) || 0) + d) * 10) / 10)))}
            onStepReps={(si, d) => onUpdateSet(ex.id, si, 'reps', String(Math.max(0, (parseInt(ex.sets[si]?.reps) || 0) + d)))}
            onComplete={(si) => onDoneSet(ex.id, si, true)}
          />
        )}

        {ex.sets.length > 0 && (
          <SetHistory
            ex={ex}
            currentIndex={currentSetIndex}
            editingIndex={editing}
            onEdit={(si) => setEditingSet({ exId: ex.id, si })}
          />
        )}

        <ExerciseQueue
          exercises={exercises}
          activeIndex={index}
          onJump={jump}
          onAdd={onAddExercise}
        />
      </div>
    </div>
  )
}
