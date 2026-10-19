// ── «بالتناوب مع…»: the card sheet's page for taking turns ─────
//
// حمزة: «نسوي ميزة تسمح انه تمرينين او اكثر يتبادلوا في الايام». The
// sheet's third page (ExerciseSheet, after «عدّل التمرين» and «بدّل
// التمرين»), on its one surface:
//
//   what it does, in a line, and the numbers every name runs on (the
//     row's — one system for all of them)
//   when the row already takes turns: its names in their order, as open
//     rows between hairlines — a small picture, the word over the one due
//     («اليوم»/«الجاي») and the one after it, the names; ↑ moves one a
//     place earlier, × takes it out (the last one left is the row alone)
//   «فكّ التناوب», under them: each name a row of its own again
//   the choices as picture cards (AltGroups): the day's own exercises for
//     the same part of the muscle first, and its natural pair («من تمارين
//     هاليوم», «بيومك» over each — one picked joins this row, its own row
//     goes), then the same muscle, then the same movement with another
//     tool; a tap adds it to the turns
//
// Every tap is written into his plan at once (App's commitPlan, as an
// edit: free for the streak), as every change on «خطتي» is.

import { useMemo } from 'react'
import { Num } from '../../components/kit/index.jsx'
import { ArrowUp, X, Repeat } from '../../components/kit/icons.js'
import SessionMedia from '../../components/player/SessionMedia.jsx'
import AltGroups from '../../components/plan/AltCards.jsx'
import { exerciseNames } from '../../components/home/HomeBits.jsx'
import { rankAlternatives, muscleOf } from '../../plan/view.js'
import { entryForName } from '../../plan/catalogue.js'
import { haptic } from '../../haptics.js'
import { turnMarks } from './RotateCard.jsx'
import { restParts, rangeText } from './PlanCard.jsx'

export default function RotateEditor({
  row, turn = null, mark, dayRows = [], pairName = null, mapping = {}, lastFor = () => null,
  onAdd, onRemove, onMove, onSplit,
}) {
  const rotating = !!turn
  const plans = turn ? turn.members : [row.planName]
  const shown = turn ? (row.rotate || turn.members) : [row.name]
  const words = turnMarks(mark)
  const j = row.at?.[1]

  // the day's own exercises for the same part of the muscle, and its
  // natural pair (the other hip machine): one picked joins the row
  const lead = useMemo(() => {
    const areaOf = (n) => { const e = entryForName(n); return e && !e.foreign ? e.area : null }
    const mine = areaOf(row.planName)
    const isPair = (n) => !!pairName && n.toLowerCase() === pairName.toLowerCase()
    const own = dayRows
      .filter(r => r.at?.[1] !== j && !r.rotate && r.muscle === row.muscle)
      .map(r => r.planName)
      .filter(n => isPair(n) || !mine || !areaOf(n) || areaOf(n) === mine)
    const pair = own.find(isPair)
    return pair ? [pair, ...own.filter(n => n !== pair)] : own
  }, [dayRows, j, row.muscle, row.planName, pairName])
  const alts = useMemo(() => rankAlternatives(row.name, {
    muscle: row.muscle,
    exclude: [...plans, ...shown, ...dayRows.flatMap(r => [r.name, r.planName, ...(r.rotate || [])])],
    tried: (n) => lastFor(n) != null,
  }), [row.name, row.muscle, plans.join('|'), dayRows]) // eslint-disable-line react-hooks/exhaustive-deps

  const { ar } = exerciseNames(row.name, mapping)
  const rest = restParts(row.rest)
  const keeps = row.unit === 'min'
    ? <><Num>{row.reps.top}</Num> دقيقة</>
    : <><Num>{row.sets}</Num> × <Num>{rangeText(row.reps)}</Num> · راحة <Num>{rest.v}</Num> {rest.u}</>
  const latinOnly = !/[؀-ۿ]/.test(ar)
  const pick = (name) => { haptic('set'); onAdd?.(name) }

  return (
    <div className="xr" data-testid="rotate-editor" data-rotating={rotating ? '1' : undefined}>
      <p className="xs-keeps">
        {rotating ? (
          <span className="xs-keeps-name">واحد كل مرة، والجاي اللي بعده</span>
        ) : (
          <span className="xs-keeps-name" dir={latinOnly ? 'ltr' : undefined}>{ar}</span>
        )}
        <span>{rotating
          ? 'كل ما جا هاليوم تسوي اللي عليه الدور. وبالجلسة تقدر تختار الثاني قبل أول مجموعة، واللي تسويه هو اللي ينحسب.'
          : 'وتمرين ثاني يتبادلون: كل ما جا هاليوم تسوي واحد، والمرة الجاية الثاني.'}</span>
        <span>نفس النظام {rotating ? 'للكل' : 'للاثنين'}: {keeps}</span>
      </p>

      {rotating && (
        <ol className="xr-list" data-testid="rotate-members">
          {plans.map((m, i) => {
            const name = shown[i] || m
            const n = exerciseNames(name, mapping)
            const word = i === turn.due ? words.due : i === turn.next ? words.next : null
            return (
              <li key={m} className="xr-m" data-name={m} data-turn={i === turn.due ? 'due' : i === turn.next ? 'next' : undefined}>
                <span className="xr-art" aria-hidden="true">
                  <SessionMedia name={name} mapping={mapping} muscle={muscleOf(name, row.muscle)} className="xr-img" />
                </span>
                <span className="xr-names">
                  {word && <span className="xr-mark">{word}</span>}
                  <span className="xr-ar" dir={/[؀-ۿ]/.test(n.ar) ? undefined : 'ltr'}>{n.ar}</span>
                  {n.en && <bdi className="xr-en" dir="ltr">{n.en}</bdi>}
                </span>
                <span className="xr-ctl">
                  {i > 0 && (
                    <button type="button" className="xr-b" data-testid="rotate-up" aria-label={`قدّم ${n.ar}`}
                      onClick={() => { haptic('swipe'); onMove?.(m) }}>
                      <ArrowUp size={18} weight="bold" aria-hidden="true" />
                    </button>
                  )}
                  <button type="button" className="xr-b" data-testid="rotate-remove" aria-label={`شيل ${n.ar} من التناوب`}
                    onClick={() => { haptic('swipe'); onRemove?.(m) }}>
                    <X size={18} weight="bold" aria-hidden="true" />
                  </button>
                </span>
              </li>
            )
          })}
        </ol>
      )}

      {rotating && (
        <div className="xr-end">
          <button type="button" className="xr-split" data-testid="rotate-split" onClick={() => { haptic('set'); onSplit?.() }}>
            <Repeat size={20} weight="bold" aria-hidden="true" />فكّ التناوب
          </button>
          <p className="xs-note">كل واحد يرجع تمرين لحاله بيومك، بنفس الأرقام.</p>
        </div>
      )}

      <h3 className="xr-h">{rotating ? 'أضف للتناوب' : 'اختر اللي يتناوب معه'}</h3>
      <AltGroups alts={alts} muscle={row.muscle} mapping={mapping} lastFor={lastFor}
        lead={{ id: 'day', title: 'من تمارين هاليوم', names: lead, tag: 'بيومك' }} onPick={pick} />
    </div>
  )
}
