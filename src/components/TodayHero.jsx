import { useMemo, useState } from 'react'
import Art from '../assets/Art.jsx'
import DayPreviewSheet from './DayPreviewSheet.jsx'
import { DropletIcon } from './Icons.jsx'
import { toWesternDigits } from '../day.js'

// ── Today Hero — the one card that answers "what now?" ────────
//
// Rebuilt around a strict hierarchy, top to bottom:
//
//   status line   — one small word about the kind of day
//   title         — the day's name, the biggest text on the page
//   meta line     — exercise count · rough duration
//   visual        — large, part of the composition, not a sticker
//   primary CTA   — ابدأ التمرين, the strongest element on the page
//   secondary     — skip / rest-credit, quiet by design
//
// The visual is anchored to the card's end edge and allowed to be
// big: it sits over a soft radial glow, clipped by the card, so it
// reads as part of the surface rather than an icon dropped onto it.
// The text keeps a reserved column and never fights it for space.

function estimateMinutes(sessions, exerciseCount) {
  const timed = (sessions || []).filter(s => s.duration > 0).slice(-5).map(s => s.duration)
  if (timed.length >= 2) {
    const sorted = [...timed].sort((a, b) => a - b)
    return Math.round(sorted[Math.floor(sorted.length / 2)])
  }
  return exerciseCount * 8
}

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

// The big side visual: the training arm, the resting moon-side art, or
// the iced dumbbell under a deload. Absolute, oversized, clipped by
// the card — composition, not decoration.
function HeroVisual({ isTraining, deload }) {
  const src = isTraining ? '/assets/hero_training.png' : '/assets/hero_rest.png'
  // Anchored to the TOP of the card, beside the text column — the CTA
  // below must stay clear of it, or the visual reads as an accident.
  const style = {
    position: 'absolute', insetInlineEnd: -16, top: -8,
    width: 160, height: 160, objectFit: 'contain',
    filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.55))',
    pointerEvents: 'none',
  }
  const glow = (
    <div style={{
      position: 'absolute', insetInlineEnd: -44, top: -54,
      width: 230, height: 230, borderRadius: '50%',
      background: `radial-gradient(circle, ${isTraining ? 'rgba(var(--cyan-rgb),0.14)' : 'rgba(var(--purple-rgb),0.12)'} 0%, transparent 68%)`,
      pointerEvents: 'none',
    }} />
  )
  const plain = <img src={src} alt="" style={style} />
  return (
    <>
      {glow}
      {deload ? <Art id="deload_hero" style={style} fallback={plain} alt="" /> : plain}
    </>
  )
}

// No letter-spacing here: the status is Arabic, and tracking pulls
// connected script apart into disjointed glyphs.
const statusLine = {
  fontFamily: 'var(--font-ar)', fontSize: 11, fontWeight: 800,
}
const titleStyle = {
  fontFamily: 'var(--font-ar)', fontSize: 28, fontWeight: 900,
  color: 'var(--text)', lineHeight: 1.25,
}
const metaStyle = {
  fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)', lineHeight: 1.7,
}
const quietBtn = {
  padding: '9px 14px', background: 'none',
  border: '1px solid var(--border)', borderRadius: 12,
  color: 'var(--text3)', fontFamily: 'var(--font-ar)',
  fontSize: 12, fontWeight: 700, cursor: 'pointer',
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

  const resting = isRecoveryDay && !active
  const tone = resting ? 'var(--purple)' : 'var(--cyan)'

  // One status word. The deload owns it while running — it colours the
  // whole app anyway, so the card only needs to say the day count.
  const status = active ? 'جلسة شغّالة'
    : onDeload ? `ديلود · اليوم ${toWesternDigits(deload.day)} من ${toWesternDigits(deload.totalDays)}`
    : resting ? 'يوم تعافٍ'
    : 'يوم تمرين'

  const title = active ? (active.name || currentPlanDay?.name || 'تمرين حر')
    : resting ? 'اليوم للراحة'
    : currentPlanDay ? currentPlanDay.name
    : 'جلسة حرة'

  return (
    <div style={{
      position: 'relative',
      background: 'var(--bg1)',
      border: '1px solid var(--border)',
      borderRadius: 20,
      padding: '18px 18px 16px',
      marginBottom: 'var(--hp-card-mb)',
      overflow: 'hidden',
    }}>
      <HeroVisual isTraining={!resting} deload={onDeload} />

      {/* Text column — reserves the visual's space instead of flowing under it */}
      <div style={{ position: 'relative', paddingInlineEnd: 132, minHeight: 138 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {onDeload && <Art id="deload_badge" size={13} fallback={<DropletIcon size={11} color={tone} />} />}
          {active && (
            <span style={{
              display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
              background: tone, animation: 'pulseDot 1.5s ease-in-out infinite',
            }} />
          )}
          <span style={{ ...statusLine, color: tone }}>{status}</span>
          {onDeload && (
            <span style={{ fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text3)' }}>
              · أوزانك أخف {toWesternDigits(deload.pct)}٪
            </span>
          )}
        </div>

        <div style={titleStyle}>{title}</div>

        <div style={{ ...metaStyle, marginTop: 6 }}>
          {active && ctx ? (
            <>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>{ctx.name}</span>
              {' · '}سيت {toWesternDigits(ctx.setNo)} من {toWesternDigits(ctx.setTotal)}
              {' · '}أنجزت {toWesternDigits(ctx.done)}/{toWesternDigits(ctx.total)}
            </>
          ) : resting ? (
            <>
              لن يُحتسب غياباً ولن يكسر الستريك.
              {currentPlanDay && <> غداً: <b style={{ color: 'var(--text2)' }}>{currentPlanDay.name}</b></>}
            </>
          ) : currentPlanDay ? (
            <span
              onClick={() => setShowSheet(true)}
              style={{ cursor: 'pointer' }}
              title="اعرض تمارين اليوم"
            >
              {toWesternDigits(currentPlanDay.exercises.length)} تمارين · ≈ {toWesternDigits(minutes)} دقيقة
              <span style={{ color: 'var(--cyan)', marginInlineStart: 6, fontSize: 11 }}>عرض ←</span>
            </span>
          ) : (
            'بلا خطة مفعّلة — ابدأ جلسة حرة، أو فعّل خطة من الإعدادات.'
          )}
        </div>
      </div>

      {/* ── Primary CTA — the strongest element on the page ── */}
      <div style={{ position: 'relative', marginTop: 16 }}>
        {active ? (
          <button className="btn-cyan btn-active-glow" onClick={onGoToWorkout}
            style={{ padding: '15px', fontSize: 16 }}>
            أكمل التمرين
          </button>
        ) : resting ? (
          <button onClick={onOverrideRecovery} style={{
            width: '100%', padding: '12px',
            background: 'transparent', border: '1px dashed var(--border2)',
            borderRadius: 12, color: 'var(--text2)',
            fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>أشعر أنني قادر على التمرين</button>
        ) : (
          <button className="btn-cyan" style={{ padding: '15px', fontSize: 16 }}
            onClick={() => currentPlanDay ? onStartPlanned(currentPlanDay) : onStartEmpty()}>
            ⚡ ابدأ التمرين
          </button>
        )}

        {/* Secondary actions — present, quiet, never competing */}
        {!active && !resting && (currentPlanDay || restCredits > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            {currentPlanDay && (
              <button onClick={onSkip} style={quietBtn}>تخطي اليوم</button>
            )}
            {restCredits > 0 && (
              <span style={{
                fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--gold)',
                padding: '9px 4px', opacity: 0.85,
              }}>🎟️ {restCredits === 1 ? 'يوم راحة اختياري متاح' : `${toWesternDigits(restCredits)} أيام راحة متاحة`}</span>
            )}
          </div>
        )}
        {resting && currentPlanDay && (
          <div style={{ marginTop: 10 }}>
            <button onClick={() => setShowSheet(true)} style={quietBtn}>
              تمارين الغد ←
            </button>
          </div>
        )}
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
