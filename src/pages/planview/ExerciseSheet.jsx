// ── One exercise of «خطتي»: what he can change ───────────────
//
// The card's sheet (the kit's Sheet: grabber, pull down to close). Its
// first page, all on the sheet's one surface: the machine big on its
// fading light, the English name under the title's Arabic, the muscle
// and the tool; two actions — «بدّله», «شوف الطريقة»; the numbers as
// open stepper rows split by hairlines: sets, reps (stepping them makes
// the range his own, repsOwn — and «رجّعها على الإعدادات» gives it
// back), rest; and last, quietly, «شيله من الخطة» (red text — «تراجع»
// brings it back). «بدّله» turns the sheet to the alternatives as picture
// cards (AltGroups), titled «بدّل التمرين» with a back arrow in its title
// row, the exercise's name and what a swap keeps under it; a tap on one
// swaps. A card's own «بدّله» opens the sheet on that page.
//
// Every change is written into his plan at once, the way the builder saves
// an edit of his own plan (App's commitPlan): free, the day he reached
// kept. The card behind shows it as it lands.

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Sheet, Num } from '../../components/kit/index.jsx'
import { ArrowsLeftRight, YoutubeLogo, Trash, Plus, Minus } from '../../components/kit/icons.js'
import SessionMedia from '../../components/player/SessionMedia.jsx'
import AltGroups from '../../components/plan/AltCards.jsx'
import { exerciseNames } from '../../components/home/HomeBits.jsx'
import { findVideoUrl } from '../../components/DayPreviewSheet.jsx'
import { arabicName } from '../../exerciseMedia.js'
import { repTargetOf } from '../../progression.js'
import { haptic } from '../../haptics.js'
import { animate, reducedMotion } from '../../motion.js'
import {
  rankAlternatives, stepList, extraWords, REP_STEPS, SEC_STEPS, REST_STEPS, MIN_SETS, MAX_SETS,
} from '../../plan/view.js'
import { Rolling, restParts, rangeText, rangeUnit, kindLine } from './PlanCard.jsx'

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
  open, row, startMode = 'main', dayNames = [], mapping = {}, lastFor = () => null, repTarget,
  canRemove = true, onSwap, onSets, onReps, onRepsReset, onRest, onRemove, onClose,
}) {
  const [mode, setMode] = useState(startMode === 'swap' ? 'swap' : 'main')
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
  const kind = kindLine(row.name, row.muscle, mapping)
  const timed = row.unit === 'min'
  const settings = repTargetOf(repTarget)
  const rest = restParts(row.rest)
  const step = (fn) => () => { haptic('swipe'); fn() }

  const reps = [row.reps.base, row.reps.top]
  const repList = row.unit === 'sec' ? SEC_STEPS : REP_STEPS
  const repNext = (dir) => stepList(repList, reps, dir)
  const same = (a, b) => a[0] === b[0] && a[1] === b[1]

  const original = row.swap?.from || null
  const swapping = mode === 'swap'
  // The alternatives' title is the session swap's («بدّل التمرين»), short
  // enough for one line beside ‹ and × on any phone; which exercise is the
  // first line under it.
  const title = swapping ? 'بدّل التمرين' : ar
  // What a swap keeps: the new machine takes this one's numbers.
  const keeps = timed
    ? <><Num>{row.reps.top}</Num> دقيقة</>
    : <><Num>{row.sets}</Num> × <Num>{rangeText(row.reps)}</Num> · راحة <Num>{rest.v}</Num> {rest.u}</>

  return (
    <Sheet open={open} onClose={onClose} title={<span data-testid="xs-title">{title}</span>} tall={swapping}
      onBack={swapping ? () => setMode('main') : undefined}>
      <div ref={body} className="xs" data-mode={mode} data-testid="exercise-sheet">
        {!swapping ? (
          <>
            <div className="xs-head">
              <span className="xs-art" aria-hidden="true">
                <SessionMedia name={row.name} mapping={mapping} muscle={row.muscle} className="xs-art-img" />
              </span>
              <span className="xs-names">
                {en && <bdi className="xs-en" dir="ltr">{en}</bdi>}
                {kind && <span className="xs-tags">{kind}</span>}
                {row.swap && (
                  <span className="xs-from">
                    <ArrowsLeftRight size={14} weight="bold" aria-hidden="true" />
                    بدل {arabicName(row.swap.from, mapping) || row.swap.from}
                  </span>
                )}
                {row.extra ? (
                  <span className="xs-from">
                    {row.extra > 0 ? <Plus size={14} weight="bold" aria-hidden="true" /> : <Minus size={14} weight="bold" aria-hidden="true" />}
                    {extraWords(row.extra)}
                  </span>
                ) : null}
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
            </div>

            <div className="xs-steps">
              <Stepper testid="xs-sets" label="المجموعات" value={row.sets}
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

            <div className="xs-end">
              <button type="button" className="xs-remove" data-testid="xs-remove" onClick={onRemove} disabled={!canRemove}>
                <Trash size={20} weight="bold" aria-hidden="true" />شيله من الخطة
              </button>
              {!canRemove && <p className="xs-note">آخر تمرين باليوم ما ينشال — اليوم ما يصير فاضي.</p>}
              <p className="xs-foot">كل تعديل ينحفظ بخطتك على طول، وما يلمس الستريك. الجلسة الجاية تمشي عليه.</p>
            </div>
          </>
        ) : (
          <>
            <p className="xs-keeps" data-testid="xs-keeps">
              <span className="xs-keeps-name" dir={en ? undefined : 'ltr'}>{ar}</span>
              <span>يبقى نفس نظامه: {keeps}</span>
            </p>
            <AltGroups alts={alts} original={original} muscle={row.muscle} mapping={mapping} lastFor={lastFor}
              onPick={(name) => { haptic('set'); onSwap(name) }} />
          </>
        )}
      </div>
    </Sheet>
  )
}
