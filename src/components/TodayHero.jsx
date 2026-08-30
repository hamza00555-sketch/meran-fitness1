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

// The visual, given a column of its own.
//
// It is absolutely positioned *inside that column* and allowed to
// overspill its box a little, so it renders generously without ever
// pushing layout around — and because the column is a real flex
// sibling of the controls, it can never sit under the button. The
// radial mask dissolves its edges into the card instead of letting
// the border crop them.
function HeroVisual({ isTraining, deload }) {
  const src = isTraining ? '/assets/hero_training.png' : '/assets/hero_rest.png'
  const fade = 'radial-gradient(closest-side, #000 58%, rgba(0,0,0,0.7) 79%, transparent 100%)'
  // The overspill lives on a wrapper, not on the image: an absolutely
  // positioned <img> with width:auto takes its intrinsic size, not the
  // inset box, and lands wherever that leaves it.
  const style = {
    display: 'block', width: '100%', height: '100%', objectFit: 'contain',
    WebkitMaskImage: fade, maskImage: fade,
  }
  const plain = <img src={src} alt="" style={style} />
  return (
    <>
      <div style={{
        position: 'absolute', insetInlineEnd: -34, top: '50%',
        transform: 'translateY(-50%)',
        width: 210, height: 210, borderRadius: '50%',
        background: `radial-gradient(circle, ${isTraining ? 'rgba(var(--cyan-rgb),0.13)' : 'rgba(var(--purple-rgb),0.12)'} 0%, transparent 68%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', insetBlock: -16, insetInlineStart: -4, insetInlineEnd: -12,
        pointerEvents: 'none',
      }}>
        {deload ? <Art id="deload_hero" style={style} fallback={plain} alt="" /> : plain}
      </div>
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
  fontFamily: 'var(--font-ar)', fontSize: 27, fontWeight: 900,
  color: 'var(--text)', lineHeight: 1.25, textWrap: 'balance',
}
// --text2, not --text3: this line carries the day's actual numbers,
// and muted grey on a near-black card is the one contrast failure
// that makes a dark UI feel unreadable.
const metaStyle = {
  fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text2)', lineHeight: 1.7,
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

  // The label sits in a column that is only ~150px wide on a 320px
  // phone, so the size is fluid and the label never wraps: a
  // two-line primary button reads as a mistake, not as emphasis.
  const ctaStyle = {
    padding: '15px 10px', fontSize: 'clamp(14px, 4.1vw, 16px)', whiteSpace: 'nowrap',
  }

  // A real action, so it stays readable. Its quietness comes from
  // having no fill next to a filled button, not from being dim.
  const skipLink = {
    background: 'none', border: 'none', padding: '6px',
    color: 'var(--text2)', fontFamily: 'var(--font-ar)',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
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

      {/* ── Status row: one pill, one quiet detail ──
          Two competing pills read as two competing statements. The
          pill states the kind of day; the deload's numbers sit beside
          it as plain text, which is what they are. */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, flexWrap: 'wrap', marginBottom: 13,
      }}>
        <span style={{ ...pill, background: toneLo, border: `1px solid ${toneMd}`, color: tone }}>
          {active ? (
            <span className="pulse-dot" style={{
              display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: tone,
            }} />
          ) : onDeload ? (
            <Art id="deload_badge" size={13} fallback={<DropletIcon size={11} color={tone} />} />
          ) : null}
          {statusWord}
        </span>
        {onDeload && (
          <span style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>
            اليوم {toWesternDigits(deload.day)} من {toWesternDigits(deload.totalDays)}
            {' · '}أخف {toWesternDigits(deload.pct)}٪
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

      {/* ── Lower zone ──
          Two real columns, not a floating image over a button: the
          controls and the visual are flex siblings, so nothing can
          ever be printed on top of the primary action. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 15 }}>

        <div style={{
          flex: '1 1 auto', minWidth: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 9,
        }}>
          {!active && !resting && restCredits > 0 && (
            <span style={{
              ...pill, alignSelf: 'flex-start',
              border: '1px solid var(--gold-md)', color: 'var(--gold)', fontSize: 12,
            }}>🎟️ {restCredits === 1 ? 'يوم راحة اختياري متاح' : `${toWesternDigits(restCredits)} أيام راحة متاحة`}</span>
          )}

          {active ? (
            <button className="btn-cyan btn-active-glow" onClick={onGoToWorkout}
              style={ctaStyle}>
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
              <button className="btn-cyan" style={ctaStyle}
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

        {/* The visual's own column: fixed share of the row, matching
            the controls' height, with the art overspilling inside it. */}
        <div style={{
          flex: '0 1 38%', maxWidth: 168, minWidth: 0, alignSelf: 'stretch',
          minHeight: 128, position: 'relative',
        }}>
          <HeroVisual isTraining={!resting} deload={onDeload} />
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
