import { useMemo, useState } from 'react'
import Art from '../assets/Art.jsx'
import DayPreviewSheet from './DayPreviewSheet.jsx'
import { DropletIcon } from './Icons.jsx'
import { toWesternDigits } from '../day.js'

// ── Today Hero — the one card that answers "what now?" ────────
//
// The home page used to scatter today across four pieces: a status
// card, a plan-day card, a separate recovery-day card, and a start
// button fixed to the bottom of the screen. Four answers to one
// question. This card is the merge: one surface that reads the day
// (training / recovery / deload / a session already running) and puts
// the single right action inside it.
//
// Everything the four pieces could do survives: the exercise-count
// badge still opens the full day preview sheet with swapping and
// YouTube links, skip is still here, the recovery override is still
// here, and the deload state rides inside as a status line rather
// than as its own banner.

// A rough length for the day, promised as a range rather than a fake
// precision. The history is the best predictor when it exists; eight
// minutes an exercise is the honest guess when it does not.
function estimateMinutes(sessions, exerciseCount) {
  const timed = (sessions || []).filter(s => s.duration > 0).slice(-5).map(s => s.duration)
  if (timed.length >= 2) {
    const sorted = [...timed].sort((a, b) => a - b)
    return Math.round(sorted[Math.floor(sorted.length / 2)])
  }
  return exerciseCount * 8
}

// Where a running session actually stands: the exercise being worked
// (first one with sets still open) and how far into it.
function sessionContext(active) {
  if (!active?.exercises?.length) return null
  const all = active.exercises.flatMap(ex => ex.sets)
  const done = all.filter(s => s.done).length
  const current = active.exercises.find(ex => ex.sets.length && !ex.sets.every(s => s.done))
    || active.exercises[active.exercises.length - 1]
  const exDone = current.sets.filter(s => s.done).length
  return {
    name: current.name,
    setNo: Math.min(exDone + 1, current.sets.length),
    setTotal: current.sets.length,
    done,
    total: all.length,
  }
}

// The little hero drawing from the old today card — training arm,
// resting moon-side art, or the iced dumbbell during a deload. It
// survives the merge because it is what makes the card feel like
// مران rather than a generic to-do item.
function HeroArt({ isTraining, deload }) {
  const style = { width: 76, height: 76, objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }
  const plain = <img src={isTraining ? '/assets/hero_training.png' : '/assets/hero_rest.png'} alt="" style={style} />
  if (!deload) return plain
  return <Art id="deload_hero" style={style} fallback={plain} alt="" />
}

const eyebrow = {
  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 2, marginBottom: 4,
}
const bigTitle = {
  fontFamily: 'var(--font-ar)', fontSize: 24, fontWeight: 900,
  color: 'var(--text)', lineHeight: 1.3,
}
const metaLine = {
  fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)', lineHeight: 1.8,
}

export default function TodayHero({
  active, currentPlanDay, planDayNum, planTotal,
  isRecoveryDay, deload, restCredits = 0,
  sessions = [], exerciseMapping = {}, exerciseSubs = {}, onCycleSub,
  onStartPlanned, onStartEmpty, onSkip, onGoToWorkout, onOverrideRecovery,
}) {
  const [showSheet, setShowSheet] = useState(false)
  const onDeload = !!deload?.active

  const ctx = useMemo(() => sessionContext(active), [active])
  const minutes = useMemo(
    () => estimateMinutes(sessions, currentPlanDay?.exercises?.length || 5),
    [sessions, currentPlanDay],
  )

  // The one accent the whole card keys off. A deload cools it, a
  // recovery day hands it to the rest colour, everything else trains.
  const tone = isRecoveryDay && !active ? 'var(--purple)' : 'var(--cyan)'

  return (
    <div style={{
      background: 'var(--grad-hero)',
      border: '1px solid var(--border)',
      borderTop: `3px solid ${tone}`,
      borderRadius: 'var(--radius)',
      padding: 'var(--hp-card-pad)',
      marginBottom: 'var(--hp-card-mb)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
    }}>

      {/* ── State line: deload rides inside, never its own banner ── */}
      {onDeload && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--cyan-lo)', border: '1px solid var(--cyan-md)',
          borderRadius: 'var(--radius-sm)', padding: '7px 12px', marginBottom: 12,
        }}>
          <Art id="deload_badge" size={16} fallback={<DropletIcon size={14} color="var(--cyan)" />} />
          <span style={{ fontFamily: 'var(--font-ar)', fontSize: 12, fontWeight: 700, color: 'var(--cyan)' }}>
            ديلود · اليوم {toWesternDigits(deload.day)} من {toWesternDigits(deload.totalDays)}
          </span>
          <span style={{ fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text3)', marginInlineStart: 'auto' }}>
            أوزانك أخف {toWesternDigits(deload.pct)}٪
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
      {active ? (
        /* ── A session is already running: continue is the only story ── */
        <>
          <div style={{ ...eyebrow, color: 'var(--cyan)' }}>
            <span style={{
              display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
              background: 'var(--cyan)', marginInlineEnd: 6,
              animation: 'pulseDot 1.5s ease-in-out infinite',
            }} />
            جلسة شغّالة
          </div>
          <div style={bigTitle}>{active.name || currentPlanDay?.name || 'تمرين حر'}</div>
          {ctx && (
            <div style={{ ...metaLine, marginTop: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>{ctx.name}</span>
              {' · '}سيت {toWesternDigits(ctx.setNo)} من {toWesternDigits(ctx.setTotal)}
              {' · '}أنجزت {toWesternDigits(ctx.done)}/{toWesternDigits(ctx.total)}
            </div>
          )}
          <button className="btn-cyan btn-active-glow" onClick={onGoToWorkout} style={{ marginTop: 14 }}>
            أكمل التمرين
          </button>
        </>
      ) : isRecoveryDay ? (
        /* ── Recovery day: rest is the plan, not the absence of one ── */
        <>
          <div style={{ ...eyebrow, color: 'var(--purple)' }}>يوم تعافٍ</div>
          <div style={bigTitle}>🌙 اليوم للراحة</div>
          <div style={{ ...metaLine, marginTop: 6 }}>
            لن يُحتسب غياباً ولن يكسر الستريك.
            {currentPlanDay && <> غداً: <b style={{ color: 'var(--text2)' }}>{currentPlanDay.name}</b></>}
          </div>
          {currentPlanDay && (
            <button
              onClick={() => setShowSheet(true)}
              style={{
                marginTop: 10, background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 20, padding: '4px 12px', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)',
              }}
            >{currentPlanDay.exercises.length} تمارين ←</button>
          )}
          <button
            onClick={onOverrideRecovery}
            style={{
              width: '100%', marginTop: 14, padding: '11px',
              background: 'transparent', border: '1px dashed var(--border2)',
              borderRadius: 12, color: 'var(--text2)',
              fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >أشعر أنني قادر على التمرين</button>
        </>
      ) : currentPlanDay ? (
        /* ── A training day with a plan: the reference layout ── */
        <>
          <div style={{ ...eyebrow, color: 'var(--cyan)' }}>
            تمرين اليوم · {toWesternDigits(planDayNum)}/{toWesternDigits(planTotal)}
          </div>
          <div style={bigTitle}>{currentPlanDay.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowSheet(true)}
              style={{
                background: 'var(--cyan-lo)', border: '1px solid var(--cyan-md)',
                borderRadius: 20, padding: '4px 12px', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cyan)', fontWeight: 700,
              }}
            >{currentPlanDay.exercises.length} تمارين ←</button>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
              ≈ {minutes} دقيقة
            </span>
            {restCredits > 0 && (
              <span style={{
                fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--gold)',
                background: 'var(--gold-lo)', border: '1px solid var(--gold-md)',
                borderRadius: 20, padding: '3px 10px',
              }}>🎟️ {restCredits === 1 ? 'يوم راحة اختياري' : `${toWesternDigits(restCredits)} أيام راحة`}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn-cyan" style={{ flex: 1 }} onClick={() => onStartPlanned(currentPlanDay)}>
              ⚡ ابدأ التمرين
            </button>
            <button onClick={onSkip} style={{
              padding: '0 16px', background: 'var(--bg3)',
              border: '1px solid var(--border2)', borderRadius: 12,
              color: 'var(--text3)', fontFamily: 'var(--font-ar)', fontSize: 13, cursor: 'pointer',
            }}>تخطي</button>
          </div>
        </>
      ) : (
        /* ── Free training, no plan ── */
        <>
          <div style={{ ...eyebrow, color: 'var(--cyan)' }}>تمرين اليوم</div>
          <div style={bigTitle}>يوم تمرين 💪</div>
          <div style={{ ...metaLine, marginTop: 6 }}>
            بلا خطة مفعّلة — ابدأ جلسة حرة، أو فعّل خطة من الإعدادات.
          </div>
          <button className="btn-cyan" onClick={onStartEmpty} style={{ marginTop: 14 }}>
            ⚡ ابدأ التمرين
          </button>
        </>
      )}

      </div>
      {!active && <HeroArt isTraining={!isRecoveryDay} deload={onDeload} />}
      </div>

      {showSheet && currentPlanDay && (
        <DayPreviewSheet
          day={currentPlanDay}
          sessions={sessions}
          exerciseMapping={exerciseMapping}
          exerciseSubs={exerciseSubs}
          onCycleSub={onCycleSub}
          onStart={() => { setShowSheet(false); onStartPlanned(currentPlanDay) }}
          onSkip={() => { setShowSheet(false); onSkip() }}
          onClose={() => setShowSheet(false)}
        />
      )}
    </div>
  )
}
