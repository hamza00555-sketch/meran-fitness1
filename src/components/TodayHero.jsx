import { useMemo, useState } from 'react'
import Art from '../assets/Art.jsx'
import DayPreviewSheet from './DayPreviewSheet.jsx'
import { DropletIcon } from './Icons.jsx'
import { toWesternDigits } from '../day.js'
import { planDayTitle } from '../utils.js'

// ── Today Hero — the one card that answers "what now?" ────────
//
// Layout after حمزة's reference mockup:
//
//   chips row      — day-kind pill · exercise count · deload / credits
//   title          — the day's name, the biggest text on the page
//   lower zone     — controls column at the inline-start, the big
//                    visual at the inline-end, faded into the surface
//   primary CTA    — ابدأ التمرين, strongest element on the page
//   two quiet      — عرض التمارين · تخطي اليوم, paired under it
//
// Everything a chip can say, a chip says: the count and the deload's
// numbers used to be sentences, and sentences made the card tall
// without making it clearer.
//
// The visual never leaves the card: it is anchored fully inside and
// its edges dissolve through a radial mask, so it reads as part of
// the surface instead of a sticker cropped by the border.

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
  padding: '4px 10px', borderRadius: 999,
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
  const exCount = currentPlanDay?.exercises?.length || 0

  const resting = isRecoveryDay && !active
  const tone = resting ? 'var(--purple)' : 'var(--cyan)'
  const toneLo = resting ? 'var(--purple-lo)' : 'var(--cyan-lo)'
  const toneMd = resting ? 'var(--purple-md)' : 'var(--cyan-md)'

  const statusWord = active ? 'جلسة شغّالة'
    : onDeload ? 'ديلود'
    : resting ? 'يوم تعافٍ'
    : 'يوم تمرين'

  // The day's name is its type — "Push Day" — not the muscles it
  // trains; those are a tap away in the preview and far too long to
  // be a heading.
  const title = active ? (planDayTitle(active) || active.name || 'تمرين حر')
    : resting ? 'اليوم للراحة'
    : currentPlanDay ? planDayTitle(currentPlanDay)
    : 'جلسة حرة'

  // The label sits in a column that is only ~150px wide on a 320px
  // phone, so the size is fluid and the label never wraps: a
  // two-line primary button reads as a mistake, not as emphasis.
  const ctaStyle = {
    padding: '14px 10px', fontSize: 'clamp(14px, 4.1vw, 16px)', whiteSpace: 'nowrap',
  }

  // The two secondary actions sit as a pair under the button. Real
  // actions, so they stay readable: their quietness comes from having
  // no fill beside a filled button, not from being dim. The size is
  // fluid because this column is ~150px wide on a 320px phone.
  const quietBtn = {
    flex: 1, minWidth: 0, padding: '9px 2px',
    background: 'none', border: '1px solid var(--border2)', borderRadius: 10,
    color: 'var(--text2)', fontFamily: 'var(--font-ar)',
    fontSize: 'clamp(10px, 3vw, 12.5px)', fontWeight: 700,
    // No nowrap here, unlike the CTA: on a 320px phone this column
    // leaves ~72px per button and the label would be cut. A secondary
    // button on two lines is fine; a clipped label never is.
    lineHeight: 1.35, cursor: 'pointer',
  }

  return (
    <div style={{
      position: 'relative',
      background: 'var(--bg1)',
      border: '1px solid var(--border)',
      borderRadius: 20,
      padding: '13px 16px 12px',
      marginBottom: 'var(--hp-card-mb)',
      overflow: 'hidden',
    }}>

      {/* ── Status row: one pill, one quiet detail ──
          Two competing pills read as two competing statements. The
          pill states the kind of day; the deload's numbers sit beside
          it as plain text, which is what they are. */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, flexWrap: 'wrap', marginBottom: 9,
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
        {/* How many exercises — a count beside the day, where the kind
            of day is already stated, instead of a sentence of its own. */}
        {!active && !resting && exCount > 0 && (
          <span style={{
            ...pill, background: 'var(--bg3)', border: '1px solid var(--border2)',
            color: 'var(--text2)', fontFamily: 'var(--font-mono)',
            // Bidi puts a trailing × in front of the digit in an RTL
            // paragraph, so "6×" came out "×6". The chip is one LTR run.
            direction: 'ltr',
          }}>{toWesternDigits(exCount)}×</span>
        )}
        {onDeload && (
          <span style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>
            اليوم {toWesternDigits(deload.day)} من {toWesternDigits(deload.totalDays)}
            {' · '}<span style={{ direction: 'ltr', display: 'inline-block' }}>−{toWesternDigits(deload.pct)}%</span>
          </span>
        )}
        {/* Rest credits: a count beside the day, not a sentence above
            the button. The ticket is the metaphor the recovery card
            already uses for these, so it stays the ticket. */}
        {!active && !resting && restCredits > 0 && (
          <span
            title={restCredits === 1 ? 'يوم راحة اختياري متاح' : `${toWesternDigits(restCredits)} أيام راحة اختيارية متاحة`}
            style={{
              ...pill, marginInlineStart: 'auto',
              border: '1px solid var(--gold-md)', color: 'var(--gold)',
              fontFamily: 'var(--font-mono)', fontSize: 12,
            }}>🎟️ {toWesternDigits(restCredits)}</span>
        )}
      </div>

      <div style={titleStyle}>{title}</div>

      {/* Only the states that have something to say say it. A planned
          day's count is a chip above and its exercises are a button
          below, so it needs no line of its own. */}
      {(active && ctx) || resting || !currentPlanDay ? (
        <div style={{ ...metaStyle, marginTop: 5 }}>
          {active && ctx ? (
            <>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>{ctx.name}</span>
              {' · '}سيت {toWesternDigits(ctx.setNo)} من {toWesternDigits(ctx.setTotal)}
              {' · '}أنجزت {toWesternDigits(ctx.done)}/{toWesternDigits(ctx.total)}
            </>
          ) : resting ? (
            <>
              لن يُحتسب غياباً ولن يكسر الستريك.
              {currentPlanDay && <> غداً: <b style={{ color: 'var(--text2)' }}>{planDayTitle(currentPlanDay)}</b></>}
            </>
          ) : (
            'بلا خطة مفعّلة — ابدأ جلسة حرة، أو فعّل خطة من الإعدادات.'
          )}
        </div>
      ) : null}

      {/* ── Lower zone ──
          Two real columns, not a floating image over a button: the
          controls and the visual are flex siblings, so nothing can
          ever be printed on top of the primary action. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 11 }}>

        <div style={{
          flex: '1 1 auto', minWidth: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8,
        }}>
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
                <button onClick={() => setShowSheet(true)} style={quietBtn}>
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
                <div style={{ display: 'flex', gap: 7 }}>
                  <button onClick={() => setShowSheet(true)} style={quietBtn}>عرض التمارين</button>
                  <button onClick={onSkip} style={quietBtn}>تخطي اليوم</button>
                </div>
              )}
            </>
          )}
        </div>

        {/* The visual's own column: fixed share of the row, matching
            the controls' height, with the art overspilling inside it. */}
        <div style={{
          flex: '0 1 38%', maxWidth: 168, minWidth: 0, alignSelf: 'stretch',
          minHeight: 116, position: 'relative',
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
