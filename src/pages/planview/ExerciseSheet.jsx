// ── One exercise of «خطتي»: what he can change ───────────────
//
// The card's sheet (the kit's Sheet: grabber, pull down to close). Its
// first page: the machine and its names, three actions — «بدّله», «شوف
// الطريقة», «شيله» — and the numbers as steppers: sets, reps (stepping
// them makes the range his own, repsOwn — and «رجّعها على الإعدادات»
// gives it back), rest. «بدّله» turns the sheet to the alternatives as
// picture cards (AltGroups); a tap on one swaps.
//
// Every change is written into his plan at once, the way the builder saves
// an edit of his own plan (App's commitPlan): free, the day he reached
// kept. The card behind shows it as it lands.

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Sheet, Num } from '../../components/kit/index.jsx'
import { ArrowsLeftRight, YoutubeLogo, Trash, Plus, Minus, CaretRight } from '../../components/kit/icons.js'
import SessionMedia from '../../components/player/SessionMedia.jsx'
import AltGroups from '../../components/plan/AltCards.jsx'
import { exerciseNames } from '../../components/home/HomeBits.jsx'
import { setsUnit } from '../../components/home/dayParts.js'
import { findVideoUrl } from '../../components/DayPreviewSheet.jsx'
import { equipLabel, arabicName } from '../../exerciseMedia.js'
import { MUSCLE_GROUPS } from '../../constants.js'
import { repTargetOf } from '../../progression.js'
import { haptic } from '../../haptics.js'
import { animate, reducedMotion } from '../../motion.js'
import {
  rankAlternatives, stepList, REP_STEPS, SEC_STEPS, REST_STEPS, MIN_SETS, MAX_SETS,
} from '../../plan/view.js'
import { Rolling, restParts, rangeText, rangeUnit } from './PlanCard.jsx'

const videoFor = (name) => findVideoUrl(name)
  || `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} proper form`)}`

function Stepper({ label, sub, value, unit, onDec, onInc, decOff, incOff, testid }) {
  return (
    <div className="xs-step" data-testid={testid}>
      <span className="xs-step-l">
        <span className="xs-step-t">{label}</span>
        {sub && <small>{sub}</small>}
      </span>
      <span className="xs-step-c">
        <button type="button" className="xs-step-b" aria-label={`${label}: أقل`} onClick={onDec} disabled={decOff}>
          <Minus size={20} weight="bold" aria-hidden="true" />
        </button>
        <span className="xs-step-v" aria-live="polite">
          <b><Rolling value={value} /></b>
          {unit && <small>{unit}</small>}
        </span>
        <button type="button" className="xs-step-b" aria-label={`${label}: أكثر`} onClick={onInc} disabled={incOff}>
          <Plus size={20} weight="bold" aria-hidden="true" />
        </button>
      </span>
    </div>
  )
}

export default function ExerciseSheet({
  open, row, dayNames = [], mapping = {}, lastFor = () => null, repTarget,
  canRemove = true, onSwap, onSets, onReps, onRepsReset, onRest, onRemove, onClose,
}) {
  const [mode, setMode] = useState('main')
  const body = useRef(null)
  // A page turn: the alternatives come in from the side the finger goes
  // (RTL: forward is to the left), the first page comes back from the other.
  const turned = useRef(false)
  useLayoutEffect(() => {
    if (!turned.current) { turned.current = true; return }
    const el = body.current
    if (!el) return
    el.closest('.k-sheet-body')?.scrollTo?.({ top: 0 })
    if (reducedMotion()) { animate(el, [{ opacity: 0 }, { opacity: 1 }], { d: 160, e: 'linear' }); return }
    const dx = mode === 'swap' ? -36 : 36
    animate(el, [{ opacity: 0, transform: `translateX(${dx}px)` }, { opacity: 1, transform: 'none' }], { spring: 'smooth' })
  }, [mode])

  const alts = useMemo(() => {
    if (!row) return { muscle: [], tool: [] }
    const original = row.swap?.from || null
    return rankAlternatives(row.name, {
      muscle: row.muscle,
      exclude: [...dayNames.filter(n => n !== row.name), ...(original ? [original] : [])],
      tried: (n) => lastFor(n) != null,
    })
  }, [row?.name, row?.muscle, row?.swap?.from, dayNames.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!row) return null
  const { ar, en } = exerciseNames(row.name, mapping)
  const group = MUSCLE_GROUPS[row.muscle]?.label || ''
  const equip = equipLabel(row.name, mapping)
  const timed = row.unit === 'min'
  const settings = repTargetOf(repTarget)
  const rest = restParts(row.rest)
  const step = (fn) => () => { haptic('swipe'); fn() }

  const reps = [row.reps.base, row.reps.top]
  const repList = row.unit === 'sec' ? SEC_STEPS : REP_STEPS
  const repNext = (dir) => stepList(repList, reps, dir)
  const same = (a, b) => a[0] === b[0] && a[1] === b[1]

  const original = row.swap?.from || null
  const title = mode === 'swap' ? `بدّل ${ar}` : ar

  return (
    <Sheet open={open} onClose={onClose} title={<span data-testid="xs-title">{title}</span>} tall={mode === 'swap'}>
      <div ref={body} className="xs" data-mode={mode} data-testid="exercise-sheet">
        {mode === 'main' ? (
          <>
            <div className="xs-head">
              <span className="xs-art" aria-hidden="true">
                <SessionMedia name={row.name} mapping={mapping} muscle={row.muscle} className="xs-art-img" />
              </span>
              <span className="xs-names">
                {en && <bdi className="xs-en" dir="ltr">{en}</bdi>}
                <span className="xs-tags">{[group, equip].filter(Boolean).join(' · ')}</span>
                {row.swap && (
                  <span className="xs-from">
                    <ArrowsLeftRight size={14} weight="bold" aria-hidden="true" />
                    بدل {arabicName(row.swap.from, mapping) || row.swap.from}
                  </span>
                )}
              </span>
            </div>

            <div className="xs-actions">
              <button type="button" className="xs-act" data-testid="xs-swap" onClick={() => setMode('swap')}>
                <ArrowsLeftRight size={22} weight="bold" aria-hidden="true" />بدّله
              </button>
              <button type="button" className="xs-act" data-testid="xs-watch"
                onClick={() => window.open(videoFor(row.name), '_blank', 'noopener,noreferrer')}>
                <YoutubeLogo size={22} weight="fill" aria-hidden="true" />شوف الطريقة
              </button>
              <button type="button" className="xs-act is-danger" data-testid="xs-remove" onClick={onRemove} disabled={!canRemove}>
                <Trash size={22} weight="bold" aria-hidden="true" />شيله
              </button>
            </div>
            {!canRemove && <p className="xs-note">آخر تمرين باليوم ما ينشال — اليوم ما يصير فاضي.</p>}

            <div className="xs-steps">
              <Stepper testid="xs-sets" label="المجموعات" value={row.sets} unit={setsUnit(row.sets)}
                decOff={row.sets <= MIN_SETS} incOff={row.sets >= MAX_SETS}
                onDec={step(() => onSets(row.sets - 1))} onInc={step(() => onSets(row.sets + 1))} />
              {timed ? (
                <div className="xs-step" data-testid="xs-reps">
                  <span className="xs-step-l"><span className="xs-step-t">المدة</span><small>جلسة كارديو</small></span>
                  <span className="xs-step-v"><b><Num>{row.reps.top}</Num></b><small>دقيقة</small></span>
                </div>
              ) : (
                <Stepper testid="xs-reps" label={row.unit === 'sec' ? 'الثواني' : 'العدّات'}
                  sub={row.own ? 'عدّاتك أنت' : 'من الإعدادات'}
                  value={rangeText(row.reps)} unit={rangeUnit(row.unit)}
                  decOff={same(repNext(-1), reps)} incOff={same(repNext(1), reps)}
                  onDec={step(() => onReps(repNext(-1)))} onInc={step(() => onReps(repNext(1)))} />
              )}
              {row.own && (
                <button type="button" className="xs-link" data-testid="xs-reps-reset" onClick={step(onRepsReset)}>
                  رجّعها على الإعدادات (<Num>{`${settings.base}–${settings.top}`}</Num>)
                </button>
              )}
              <Stepper testid="xs-rest" label="الراحة" value={rest.v} unit={rest.u === 'ث' ? 'ثانية' : 'دقيقة'}
                decOff={row.rest <= REST_STEPS[0]} incOff={row.rest >= REST_STEPS[REST_STEPS.length - 1]}
                onDec={step(() => onRest(stepList(REST_STEPS, row.rest, -1)))}
                onInc={step(() => onRest(stepList(REST_STEPS, row.rest, 1)))} />
            </div>
            <p className="xs-foot">كل تعديل ينحفظ بخطتك على طول، وما يلمس الستريك. الجلسة الجاية تمشي عليه.</p>
          </>
        ) : (
          <>
            <button type="button" className="xs-back" onClick={() => setMode('main')}>
              <CaretRight size={18} weight="bold" aria-hidden="true" />رجوع
            </button>
            <AltGroups alts={alts} original={original} muscle={row.muscle} mapping={mapping} lastFor={lastFor}
              onPick={(name) => { haptic('set'); onSwap(name) }} />
          </>
        )}
      </div>
    </Sheet>
  )
}
