// ── One exercise of «خطتي», as a card ────────────────────────
//
// One surface, nothing boxed inside it. Read right to left: the machine
// first — its picture standing on a soft light that fades out before the
// card's edge, cropped to the machine so it fills the frame — then the
// Arabic name, the English directly under it on the same edge, the muscle
// and the tool as one quiet line, and, only when there is something true
// to say, what he changed («بدّلته بدل …», «مجموعة زيادة»). Under a
// hairline, the numbers he trains by: sets and reps big (his own range
// says «عدّاتك أنت» under it), the rest a step quieter. Last, what he did
// on it last time (his best only when it is more — its figure gold, as the
// player draws «أعلى وزن») and «بدّله».
//
// The whole card opens the exercise's sheet (ExerciseSheet); «بدّله» opens
// it straight on the alternatives. On a day that has both of a natural
// pair (the hip abduction and adduction machines), a last line under a
// hairline offers «خلّهم بالتناوب» — the two become one row that takes
// turns (src/plan/rotate.js) — and × waves it off for good. When the sheet changes it, the card
// shows it: a swap brings the new machine in (the picture a little behind,
// then the names), a number rolls to its new value, a new note pops in.

import { useLayoutEffect, useMemo, useRef } from 'react'
import { Num } from '../../components/kit/index.jsx'
import { ArrowsLeftRight, Plus, Minus, Repeat, X } from '../../components/kit/icons.js'
import SessionMedia from '../../components/player/SessionMedia.jsx'
import SetPhrase from '../../components/player/SetPhrase.jsx'
import RollNumber from '../../components/RollNumber.jsx'
import { exerciseNames } from '../../components/home/HomeBits.jsx'
import { setsUnit } from '../../components/home/dayParts.js'
import { previousSets, kg } from '../../components/player/sessionWords.js'
import { getExerciseStats } from '../../utils.js'
import { equipLabel, arabicName } from '../../exerciseMedia.js'
import { MUSCLE_GROUPS } from '../../constants.js'
import { extraWords } from '../../plan/view.js'
import { animate, reducedMotion, rise } from '../../motion.js'

/** A number that rolls from what it was last render to what it is now. */
export function Rolling({ value, className }) {
  const v = String(value)
  const st = useRef({ from: v, to: v })
  if (st.current.to !== v) st.current = { from: st.current.to, to: v }
  return <RollNumber from={st.current.from} to={st.current.to} className={className} />
}

/** The rest as a figure and its unit: «90» «ث», «2» «د», «2½» «د». */
export function restParts(s) {
  const n = Math.max(0, Math.round(Number(s) || 0))
  if (n < 120) return { v: String(n), u: 'ث' }
  const m = n / 60
  return { v: m % 1 ? `${Math.floor(m)}½` : String(m), u: 'د' }
}

/** The range as printed: «12–15», «10». */
export const rangeText = (r) => (r.top > r.base ? `${r.base}–${r.top}` : String(r.base))
export const rangeUnit = (unit) => (unit === 'sec' ? 'ثانية' : unit === 'min' ? 'دقيقة' : 'عدّة')

/** The groups as the plans write them: «صدر»، not «الصدر» — the day
 *  header's words, so the card, its sheet and the header say the same. */
const GROUP_WORD = { Chest: 'صدر', Back: 'ظهر', Shoulders: 'أكتاف', Legs: 'أرجل', Biceps: 'بايسبس', Triceps: 'ترايسبس', Core: 'بطن', Cardio: 'كارديو' }
export const groupWord = (muscle) => GROUP_WORD[muscle] || MUSCLE_GROUPS[muscle]?.label || ''

/** «ظهر · جهاز» — the muscle and the tool, one line. */
export const kindLine = (name, muscle, mapping) => [groupWord(muscle), equipLabel(name, mapping)].filter(Boolean).join(' · ')

/** The heaviest set of the last session that had it (more reps on a tie). */
export function topSet(sets) {
  let best = null
  for (const s of sets || []) {
    const w = parseFloat(s.weight) || 0, r = parseInt(s.reps) || 0
    if (!best || w > best.w || (w === best.w && r > best.r)) best = { w, r, set: s }
  }
  return best?.set || null
}

export default function PlanCard({ row, mapping = {}, sessions = [], flash = 0, offer = null, onOpen, onSwap }) {
  const ref = useRef(null)
  const { ar, en } = exerciseNames(row.name, mapping)
  const kind = kindLine(row.name, row.muscle, mapping)
  const stats = useMemo(() => getExerciseStats(sessions, row.name, mapping), [sessions, row.name, mapping])
  const last = useMemo(() => topSet(previousSets(sessions, row.name, mapping)), [sessions, row.name, mapping])
  const rest = restParts(row.rest)
  const fromAr = row.swap ? (arabicName(row.swap.from, mapping) || row.swap.from) : ''
  const timed = row.unit === 'min'
  // His best, only when it says something the last time doesn't.
  const lastW = last ? parseFloat(last.weight) || 0 : (stats.lastWeight ?? null)
  const best = stats.maxWeight != null && stats.maxWeight > 0 && (lastW == null || stats.maxWeight > lastW) ? stats.maxWeight : null

  // What the sheet just changed, shown on the card: the new machine
  // comes in, the card settles, a new note pops.
  const seen = useRef({ name: row.name, flash })
  useLayoutEffect(() => {
    const was = seen.current
    seen.current = { name: row.name, flash }
    if (was.flash === flash) return
    const el = ref.current
    if (!el) return
    if (reducedMotion()) { animate(el, [{ opacity: 0.6 }, { opacity: 1 }], { d: 200, e: 'linear' }); return }
    animate(el, [{ transform: 'scale(0.97)' }, { transform: 'none' }], { spring: 'bouncy' })
    animate(el, [{ boxShadow: 'inset 0 0 0 2px var(--ink-2)' }, { boxShadow: 'inset 0 0 0 1px var(--edge)' }], { d: 900, fill: 'none' })
    if (was.name !== row.name) {
      animate(el.querySelector('.pv-art-img'), [{ opacity: 0, transform: 'translateX(-28px) scale(.9)' }, { opacity: 1, transform: 'none' }], { spring: 'smooth', delay: 60 })
      ;['.pv-ar', '.pv-en', '.pv-kind'].forEach((s, i) => animate(el.querySelector(s), rise(8), { d: 260, delay: 140 + i * 50 }))
    }
  }, [flash, row.name])

  return (
    <div ref={ref} className="pv-card" data-testid="plan-card" data-name={row.name}>
      <span className="pv-art" aria-hidden="true">
        <SessionMedia key={row.name} name={row.name} mapping={mapping} muscle={row.muscle} className="pv-art-img" />
      </span>

      <span className="pv-head">
        {/* The card's one target: its ::after covers the whole card. */}
        <button type="button" className="pv-open" onClick={onOpen}>
          <span className="pv-ar" dir={/[؀-ۿ]/.test(ar) ? undefined : 'ltr'}>{ar}</span>
        </button>
        {en && <bdi className="pv-en" dir="ltr">{en}</bdi>}
        {kind && <span className="pv-kind">{kind}</span>}
        {row.swap && (
          <span className="pv-note" data-badge="swap">
            <ArrowsLeftRight size={14} weight="bold" aria-hidden="true" />بدّلته بدل {fromAr}
          </span>
        )}
        {row.extra ? (
          <span className="pv-note" data-badge="sets">
            {row.extra > 0 ? <Plus size={14} weight="bold" aria-hidden="true" /> : <Minus size={14} weight="bold" aria-hidden="true" />}
            {extraWords(row.extra)}
          </span>
        ) : null}
      </span>

      <span className="pv-stats">
        <span className="pv-stat" data-stat="sets">
          <b><Rolling value={row.sets} /></b>
          <small>{setsUnit(row.sets)}</small>
        </span>
        <span className="pv-stat" data-stat="reps" data-own={row.own ? '1' : undefined}>
          <b><Rolling value={timed ? String(row.reps.top) : rangeText(row.reps)} /></b>
          <small>{row.own && !timed ? 'عدّاتك أنت' : rangeUnit(row.unit)}</small>
        </span>
        <span className="pv-stat" data-stat="rest">
          <b><Rolling value={rest.v} /><span className="pv-stat-u">{rest.u}</span></b>
          <small>راحة</small>
        </span>
      </span>

      <span className="pv-foot">
        <span className="pv-hist">
          {last ? (
            <span className="pv-hist-part">آخر مرة <SetPhrase set={last} unit={row.unit} /></span>
          ) : stats.lastWeight != null ? (
            <span className="pv-hist-part">آخر مرة <span className="s-pair"><Num>{kg(stats.lastWeight)}</Num> كجم</span></span>
          ) : (
            <span className="pv-hist-part">ما سوّيته للحين</span>
          )}
          {best != null && (
            <span className="pv-hist-part pv-best">أعلى <span className="s-pair"><Num>{kg(best)}</Num> كجم</span></span>
          )}
        </span>
        <button type="button" className="pv-swap" data-testid="plan-card-swap" aria-label={`بدّل ${ar}`} onClick={onSwap}>
          <ArrowsLeftRight size={16} weight="bold" aria-hidden="true" /><span className="pv-swap-t">بدّله</span>
        </button>
      </span>

      {offer && <Offer offer={offer} ar={ar} mapping={mapping} />}
    </div>
  )
}

/** «خلّهم بالتناوب»: this one and its pair become one row that takes turns. */
function Offer({ offer, ar, mapping }) {
  const other = exerciseNames(offer.name, mapping).ar
  return (
    <span className="pv-offer">
      <button type="button" className="pv-offer-go" data-testid="rotate-offer" onClick={offer.onMerge}>
        <Repeat size={20} weight="bold" aria-hidden="true" />
        <span className="pv-offer-t">
          <b>خلّهم بالتناوب</b>
          <small>مرة هذا ومرة {other}</small>
        </span>
      </button>
      <button type="button" className="pv-offer-x" data-testid="rotate-offer-off"
        aria-label={`لا، خلّ ${ar} و${other} الاثنين`} onClick={offer.onDismiss}>
        <X size={18} weight="bold" aria-hidden="true" />
      </button>
    </span>
  )
}
