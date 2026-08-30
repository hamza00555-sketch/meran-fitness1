import { useMemo, useState } from 'react'
import Art from '../assets/Art.jsx'
import DayPreviewSheet from './DayPreviewSheet.jsx'
import { DropletIcon } from './Icons.jsx'
import { toWesternDigits } from '../day.js'

// ── Today Hero — the one card that answers "what now?" ────────
//
// Layout after حمزة's reference mockup:
//
//   chips row      — day-kind pill (+ deload day count / lighter-% pill)
//   title          — the day's name, the biggest text on the page
//   meta line      — exercise count · rough duration (tap → preview)
//   lower zone     — controls column at the inline-start, the big
//                    visual at the inline-end, faded into the surface
//   primary CTA    — ابدأ التمرين, strongest element on the page
//   skip           — a bare text link under the CTA
//
// The visual never leaves the card: it is anchored fully inside and
// its edges dissolve through a radial mask, so it reads as part of
// the surface instead of a sticker cropped by the border.

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

// The big visual, dissolved into the card: contained inside the
// bounds, edges faded by a radial mask over a soft glow.
function HeroVisual({ isTraining, deload }) {
  const src = isTraining ? '/assets/hero_training.png' : '/assets/hero_rest.png'
  const fade = 'radial-gradient(closest-side, #000 60%, rgba(0,0,0,0.72) 80%, transparent 100%)'
  const style = {
    position: 'absolute', insetInlineEnd: 0, bottom: 0,
    width: 'min(192px, 50%)', height: 198, objectFit: 'contain',
    WebkitMaskImage: fade, maskImage: fade,
    pointerEvents: 'none',
  }
  const glow = (
    <div style={{
      position: 'absolute', insetInlineEnd: -30, bottom: -46,
      width: 250, height: 250, borderRadius: '50%',
      background: `radial-gradient(circle, ${isTraining ? 'rgba(var(--cyan-rgb),0.12)' : 'rgba(var(--purple-rgb),0.11)'} 0%, transparent 66%)`,
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

const pill = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '5px 12px', borderRadius: 999,
  fontFamily: 'var(--font-ar)', fontSize: 12, fontWeight: 800,
  lineHeight: 1.4, whiteSpace: 'nowrap',
}
const titleStyle = {
  fontFamily: 'var(--font-ar)', fontSize: 28, fontWeight: 900,
  color: 'var(--text)', lineHeight: 1.25,
}
const metaStyle = {
  fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)', lineHeight: 1.7,
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
  const toneLo = resting ? 'var(--purple-lo)' : 'var(--cyan-lo)'
  const toneMd = resting ? 'var(--purple-md)' : 'var(--cyan-md)'

  const statusWord = active ? 'جلسة شغّالة'
    : onDeload ? 'ديلود'
    : resting ? 'يوم تعافٍ'
    : 'يوم تمرين'

  const title = active ? (active.name || currentPlanDay?.name || 'تمرين حر')
    : resting ? 'اليوم للراحة'
    : currentPlanDay ? currentPlanDay.name
    : 'جلسة حرة'

  const skipLink = {
    background: 'none', border: 'none', padding: '7px 6px',
    color: 'var(--text3)', fontFamily: 'var(--font-ar)',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
  }

  return (
    <div style={{
      position: 'relative',
      background: 'var(--bg1)',
      border: '1px solid var(--border)',
      borderRadius: 20,
      padding: '16px 18px 14px',
      marginBottom: 'var(--hp-card-mb)',
      overflow: 'hidden',
    }}>

      {/* ── Chips row ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, flexWrap: 'wrap', marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <span style={{ ...pill, background: toneLo, border: `1px solid ${toneMd}`, color: tone }}>
            {onDeload && <Art id="deload_badge" size={13} fallback={<DropletIcon size={11} color={tone} />} />}
            {active && (
              <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: tone, animation: 'pulseDot 1.5s ease-in-out infinite',
              }} />
            )}
            {statusWord}
          </span>
          {onDeload && (
            <span style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>
              اليوم {toWesternDigits(deload.day)} من {toWesternDigits(deload.totalDays)}
            </span>
          )}
        </div>
        {onDeload && (
          <span style={{ ...pill, border: `1px solid ${toneMd}`, color: tone, fontSize: 11 }}>
            ↓ أوزانك أخف {toWesternDigits(deload.pct)}٪
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

      {/* ── Lower zone: controls at inline-start, visual at inline-end ── */}
      <div style={{ position: 'relative', marginTop: 16, minHeight: 148 }}>
        <HeroVisual isTraining={!resting} deload={onDeload} />

        <div style={{
          position: 'relative', width: '62%', minWidth: 200, maxWidth: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'stretch',
          gap: 10, paddingTop: 6,
        }}>
          {!active && !resting && restCredits > 0 && (
            <span style={{
              ...pill, alignSelf: 'flex-start',
              border: '1px solid var(--gold-md)', color: 'var(--gold)', fontSize: 12,
            }}>🎟️ {restCredits === 1 ? 'يوم راحة اختياري متاح' : `${toWesternDigits(restCredits)} أيام راحة متاحة`}</span>
          )}

          {active ? (
            <button className="btn-cyan btn-active-glow" onClick={onGoToWorkout}
              style={{ padding: '15px', fontSize: 16 }}>
              أكمل التمرين
            </button>
          ) : resting ? (
            <>
              <button onClick={onOverrideRecovery} style={{
                width: '100%', padding: '12px',
                background: 'transparent', border: '1px dashed var(--border2)',
                borderRadius: 12, color: 'var(--text2)',
                fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>أشعر أنني قادر على التمرين</button>
              {currentPlanDay && (
                <button onClick={() => setShowSheet(true)} style={{ ...skipLink, alignSelf: 'center' }}>
                  تمارين الغد ←
                </button>
              )}
            </>
          ) : (
            <>
              <button className="btn-cyan" style={{ padding: '15px', fontSize: 16 }}
                onClick={() => currentPlanDay ? onStartPlanned(currentPlanDay) : onStartEmpty()}>
                ⚡ ابدأ التمرين
              </button>
              {currentPlanDay && (
                <button onClick={onSkip} style={{ ...skipLink, alignSelf: 'center' }}>
                  تخطي اليوم ←
                </button>
              )}
            </>
          )}
        </div>
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
