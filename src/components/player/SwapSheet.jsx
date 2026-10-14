// ── «استبدال التمرين», with the pictures ─────────────────────
//
// حمزة: «لما أنا أسوي استبدال وسط التمرين يزعجني جداً أنا ما أقدر أشوف إيش
// التمرين الجاي ولا حتى أعرف إيش هو هذا اللي رايح له». The swap used to
// cycle to the next name in a list, blind, and remember it for good. Now:
//
//   the exercise he is on, with its picture and its place in the session
//   right under it, the rest of the session as a strip of pictures, the
//     next exercise first («التالي»)
//   the alternatives as picture cards (AltGroups — the same muscle first,
//     then the same movement with another tool; the plan's own exercise
//     first, «الأصلي», when this one is already a swap)
//
// A tap picks a card; then «بس هالمرة» (this session only) or «دايماً
// بخطتي» (written into his plan, the way «خطتي» writes it — free for the
// streak). An exercise that is not from his plan (added in the session, a
// free session) has only the swap for now.
//
// Only offered before the first set is logged, as before: done sets are
// never re-attributed to another machine.

import { useState } from 'react'
import { Sheet, Button, Num } from '../kit/index.jsx'
import SessionMedia from './SessionMedia.jsx'
import AltGroups from '../plan/AltCards.jsx'
import { arabicName } from '../../exerciseMedia.js'
import { setsPhrase } from './sessionWords.js'

function Thumb({ name, mapping, muscle }) {
  return (
    <span className="sw-thumb" aria-hidden="true">
      <SessionMedia name={name} mapping={mapping} muscle={muscle} />
    </span>
  )
}

export default function SwapSheet({
  open, ex, mapping = {}, options, position = null, upcoming = [], lastFor = () => null, onPick, onClose,
}) {
  const [picked, setPicked] = useState(null)
  if (!ex || !options) return null
  const ar = arabicName(ex.name, mapping)
  const pickedAr = picked ? (arabicName(picked, mapping) || picked) : ''
  const go = (always) => { if (picked) onPick?.(picked, { always }) }

  const footer = picked ? (
    <div className="sw-foot" data-testid="swap-foot">
      <p className="sw-foot-what"><b>{pickedAr}</b> بدل {ar || ex.name}</p>
      <div className="sw-foot-btns">
        <Button variant="primary" size="lg" onClick={() => go(false)} data-testid="swap-once">
          {options.canAlways ? 'بس هالمرة' : 'بدّله'}
        </Button>
        {options.canAlways && (
          <Button variant="secondary" size="lg" onClick={() => go(true)} data-testid="swap-always">دايماً بخطتي</Button>
        )}
      </div>
      <p className="sw-foot-note">
        {options.canAlways
          ? '«بس هالمرة» لهالجلسة بس. «دايماً» ينحفظ بخطتك وما يلمس الستريك.'
          : 'لهالجلسة. هالتمرين مو من خطتك.'}
      </p>
    </div>
  ) : null

  return (
    <Sheet open={open} onClose={onClose} title="بدّل التمرين" tall footer={footer}>
      <div className="sw" data-testid="swap-sheet">
        <div className="sw-now">
          <Thumb name={ex.name} mapping={mapping} muscle={ex.muscle} />
          <span className="sw-now-text">
            <small>
              الحين{position ? <> · التمرين <Num>{position.at}</Num> من <Num>{position.of}</Num></> : null}
            </small>
            <b>{ar || <bdi dir="ltr">{ex.name}</bdi>}</b>
            {ar && <bdi className="sw-en" dir="ltr">{ex.name}</bdi>}
          </span>
        </div>

        <section className="sw-next" aria-label="بعده بالجلسة" data-testid="swap-upcoming">
          <h3 className="ac-h">بعده بالجلسة</h3>
          {upcoming.length ? (
            <ol>
              {upcoming.map((u, i) => {
                const uar = arabicName(u.name, mapping)
                const ph = setsPhrase(u.sets.length)
                return (
                  <li key={u.id} data-first={i === 0 ? '1' : undefined}>
                    <Thumb name={u.name} mapping={mapping} muscle={u.muscle} />
                    <span className="sw-next-names">
                      {i === 0 && <small>التالي</small>}
                      <b dir={uar ? undefined : 'ltr'}>{uar || u.name}</b>
                      <span className="sw-next-sets">{ph.num != null && <><Num>{ph.num}</Num> </>}{ph.word}</span>
                    </span>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="sw-next-none">هذا آخر تمرين بالجلسة.</p>
          )}
        </section>

        <AltGroups alts={options.alts} original={options.origin} muscle={ex.muscle} mapping={mapping}
          lastFor={lastFor} selected={picked} onPick={(n) => setPicked(p => (p === n ? null : n))} />
      </div>
    </Sheet>
  )
}
