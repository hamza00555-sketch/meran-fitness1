// ── The alternatives, as pictures ─────────────────────────────
//
// حمزة: «أنا ما أقدر أشوف إيش التمرين الجاي ولا حتى أعرف إيش هو هذا اللي
// رايح له». So a swap never cycles blind again: every choice is a card
// with the machine's picture on the stage light, its Arabic name with the
// English under it, the tool, and the weight he last used on it.
//
// Two groups (src/plan/view.js rankAlternatives): the same muscle first,
// then the same movement with another tool. When the exercise was already
// swapped, the original leads, marked «الأصلي». Used by «خطتي»'s card
// sheet (a tap swaps) and the session's swap sheet (a tap picks, then «بس
// هالمرة» or «دايماً بخطتي»).
//
// The picture is the pack's still when it is on the phone (or streams
// once from the site), the muscle's own art otherwise — SessionMedia's
// ladder, never a broken image.

import { Num } from '../kit/index.jsx'
import { Check } from '../kit/icons.js'
import SessionMedia from '../player/SessionMedia.jsx'
import { arabicName, equipLabel } from '../../exerciseMedia.js'
import { MUSCLE_GROUPS } from '../../constants.js'
import { muscleOf } from '../../plan/view.js'
import { kg } from '../player/sessionWords.js'
import '../../styles/screens/swap.css'

/** One choice: the picture, the names, the tool, the last weight. */
export function AltCard({ name, mapping = {}, muscle = null, last = null, tag = null, selected = false, onPick }) {
  const ar = arabicName(name, mapping)
  const equip = equipLabel(name, mapping)
  return (
    <button type="button" className="ac" aria-pressed={selected} data-testid="alt-card" data-name={name}
      onClick={() => onPick?.(name)}>
      <span className="ac-art" aria-hidden="true">
        <SessionMedia name={name} mapping={mapping} muscle={muscleOf(name, muscle)} className="ac-img" />
        {tag && <span className="ac-tag">{tag}</span>}
        {selected && <span className="ac-check"><Check size={16} weight="bold" /></span>}
      </span>
      <span className="ac-names">
        <span className="ac-ar" dir={ar ? undefined : 'ltr'}>{ar || name}</span>
        {ar && <bdi className="ac-en" dir="ltr">{name}</bdi>}
      </span>
      <span className="ac-meta">
        {equip && <span className="ac-equip">{equip}</span>}
        <span className="ac-last">
          {last != null ? <>آخر مرة <Num>{kg(last)}</Num> كجم</> : 'ما جرّبته'}
        </span>
      </span>
    </button>
  )
}

/**
 * The groups, each a two-column grid of cards.
 *   alts      { muscle: [names], tool: [names] }
 *   original  the exercise it replaced, offered first as «الأصلي» (or null)
 *   lastFor   name → the last weight on it, or null
 */
export default function AltGroups({ alts, original = null, muscle = null, mapping = {}, lastFor = () => null, selected = null, onPick }) {
  const card = (n, tag = null) => (
    <AltCard key={n} name={n} mapping={mapping} muscle={muscle} last={lastFor(n)} tag={tag}
      selected={selected === n} onPick={onPick} />
  )
  const label = MUSCLE_GROUPS[muscle]?.label
  const groups = [
    { id: 'muscle', title: label ? `لنفس العضلة · ${label}` : 'لنفس العضلة', names: alts?.muscle || [] },
    { id: 'tool', title: 'نفس الحركة بأداة ثانية', names: alts?.tool || [] },
  ].filter(g => g.names.length)
  return (
    <div className="ac-groups">
      {original && (
        <section className="ac-group" data-group="original">
          <h3 className="ac-h">ترجع للي كان بخطتك</h3>
          <div className="ac-grid">{card(original, 'الأصلي')}</div>
        </section>
      )}
      {groups.map(g => (
        <section key={g.id} className="ac-group" data-group={g.id}>
          <h3 className="ac-h">{g.title}</h3>
          <div className="ac-grid">{g.names.map(n => card(n))}</div>
        </section>
      ))}
      {!original && !groups.length && <p className="ac-none">ما لقينا له بديل.</p>}
    </div>
  )
}
