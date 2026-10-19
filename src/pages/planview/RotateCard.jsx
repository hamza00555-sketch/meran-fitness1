// ── «بالتناوب»: a row of «خطتي» that takes turns, as one card ──
//
// حمزة: «اليوم رجول بسوي هيب ابدكشن اجي يوم ثاني للرجول يعمل هيب اددكشن».
// One surface, nothing boxed inside it, the plan card's language: its
// first line says what it is — «بالتناوب · واحد كل مرة» — then the names
// it takes turns between, each a small picture on its light with the
// Arabic name and the English under it, in turn order: the one due first,
// a word over its name — «اليوم» on today's day (or the session running
// it), «الجاي» on another — and «المرة الجاية» / «بعده» over the one
// after it. Under a hairline, the numbers all of them run on (one system
// for the row), then what he did last time on the one due and «التناوب»,
// which opens the sheet on its page («بالتناوب مع…», RotateEditor). «آخر
// مرة» is the one due's, the top one.
//
// Which is due comes from his sessions (src/plan/rotate.js rotationTurn),
// never from storage.

import { useLayoutEffect, useMemo, useRef } from 'react'
import { Num } from '../../components/kit/index.jsx'
import { Repeat } from '../../components/kit/icons.js'
import SessionMedia from '../../components/player/SessionMedia.jsx'
import SetPhrase from '../../components/player/SetPhrase.jsx'
import { exerciseNames } from '../../components/home/HomeBits.jsx'
import { setsUnit } from '../../components/home/dayParts.js'
import { previousSets, kg } from '../../components/player/sessionWords.js'
import { getExerciseStats } from '../../utils.js'
import { muscleOf } from '../../plan/view.js'
import { turnOrder } from '../../plan/rotate.js'
import { animate, reducedMotion, rise } from '../../motion.js'
import { Rolling, restParts, rangeText, rangeUnit, topSet } from './PlanCard.jsx'

/** The words over a name: the one due, the one after it. */
export function turnMarks(mark) {
  const now = mark === 'today' || mark === 'live'
  return { due: now ? 'اليوم' : 'الجاي', next: now ? 'المرة الجاية' : 'بعده' }
}

/**
 * The names a row takes turns between, in turn order (the one due first),
 * each with its picture and the word over it. `names` are the names the
 * session runs (a remembered swap applied), `turn` the row's turn.
 */
export function RotateMembers({ names, turn, mark, mapping = {}, muscle = null, className = 'pv-rmembers', item = 'pv-rm' }) {
  const words = turnMarks(mark)
  const order = turnOrder(turn)
  return (
    <ol className={className}>
      {order.map((i, k) => {
        const name = names[i] || turn.members[i]
        const { ar, en } = exerciseNames(name, mapping)
        const word = k === 0 ? words.due : k === 1 ? words.next : null
        return (
          <li key={turn.members[i]} className={item} data-name={name} data-turn={k === 0 ? 'due' : k === 1 ? 'next' : undefined}>
            <span className={`${item}-art`} aria-hidden="true">
              <SessionMedia name={name} mapping={mapping} muscle={muscleOf(name, muscle)} className={`${item}-img`} />
            </span>
            <span className={`${item}-names`}>
              {word && <span className={`${item}-mark`} data-testid="rotate-mark">{word}</span>}
              <span className={`${item}-ar`} dir={/[؀-ۿ]/.test(ar) ? undefined : 'ltr'}>{ar}</span>
              {en && <bdi className={`${item}-en`} dir="ltr">{en}</bdi>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default function RotateCard({ row, turn, mark, mapping = {}, sessions = [], flash = 0, onOpen, onEdit }) {
  const ref = useRef(null)
  const names = row.rotate || turn.members
  const due = names[turn.due] || row.name
  const stats = useMemo(() => getExerciseStats(sessions, due, mapping), [sessions, due, mapping])
  const last = useMemo(() => topSet(previousSets(sessions, due, mapping)), [sessions, due, mapping])
  const rest = restParts(row.rest)
  const timed = row.unit === 'min'
  const all = names.map(n => exerciseNames(n, mapping).ar).join(' و')

  // What the sheet just changed, shown on the card: it settles, and when
  // the names changed (one added, out, moved) they come in again.
  const seen = useRef({ names: names.join('|'), flash })
  useLayoutEffect(() => {
    const was = seen.current
    seen.current = { names: names.join('|'), flash }
    if (was.flash === flash) return
    const el = ref.current
    if (!el) return
    if (reducedMotion()) { animate(el, [{ opacity: 0.6 }, { opacity: 1 }], { d: 200, e: 'linear' }); return }
    animate(el, [{ transform: 'scale(0.97)' }, { transform: 'none' }], { spring: 'bouncy' })
    animate(el, [{ boxShadow: 'inset 0 0 0 2px var(--ink-2)' }, { boxShadow: 'inset 0 0 0 1px var(--edge)' }], { d: 900, fill: 'none' })
    if (was.names !== names.join('|')) [...el.querySelectorAll('.pv-rm')].forEach((x, i) => animate(x, rise(10), { spring: 'smooth', delay: 60 + i * 70 }))
  }, [flash, names.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={ref} className="pv-card pv-rcard" data-testid="plan-card" data-rotate="1" data-name={row.name}>
      <span className="pv-rtag">
        <Repeat size={18} weight="bold" aria-hidden="true" />
        {/* The card's one target: its ::after covers the whole card. */}
        <button type="button" className="pv-open" aria-label={`بالتناوب: ${all}`} onClick={onOpen}>
          <b>بالتناوب</b>
        </button>
        <span className="pv-rtag-sub">· واحد كل مرة</span>
      </span>

      <RotateMembers names={names} turn={turn} mark={mark} mapping={mapping} muscle={row.muscle} />

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
        </span>
        <button type="button" className="pv-swap" data-testid="plan-card-rotate" aria-label={`عدّل التناوب: ${all}`} onClick={onEdit}>
          <Repeat size={16} weight="bold" aria-hidden="true" /><span className="pv-swap-t">التناوب</span>
        </button>
      </span>
    </div>
  )
}
