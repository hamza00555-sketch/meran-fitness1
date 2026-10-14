// ── Records inside a session ──────────────────────────────────
// Pure: no React, no DOM, so the rules are unit-tested on their own
// (tests/session-records.test.mjs).
//
// A record is a new weight against everything before today, not against
// today's earlier sets (حمزة: «انا ابا احتفالية وكأس مدام رفعت الوزن
// الجديد»): once he lifts 45 over the 40 on record, every set he finishes
// at 45 (or more) that day wears the trophy and gets the celebration —
// set 3 at 45 is as much a new weight as set 2 was. Never in a deload,
// never the first time an exercise is done (nothing on record to beat).

/** The indexes of the done sets heavier than the best on record before today. */
export function prSetsOf(sets, maxWeight, deloadPct = 0) {
  if (deloadPct > 0 || maxWeight == null) return []
  const out = []
  ;(sets || []).forEach((s, i) => {
    if (s?.done && parseFloat(s.weight) > maxWeight) out.push(i)
  })
  return out
}

/** The heaviest weight already done today on this exercise (null: none yet). */
export function todayTopOf(sets) {
  let top = null
  for (const s of sets || []) {
    const w = parseFloat(s?.weight)
    if (s?.done && w > 0 && (top == null || w > top)) top = w
  }
  return top
}

/**
 * What the coach says when the engine says raise. The step up is last
 * time's weight plus one plate («جرّب 42.5»); once he has already lifted
 * that or more today, suggesting it would tell him to go lighter than he
 * just did — so the line says to hold today's weight («ثبّت على 45»).
 *   → { kind: 'try', kg } | { kind: 'hold', kg } | null
 */
export function raiseAdvice(raisedW, todayTop) {
  if (raisedW == null) return null
  if (todayTop != null && todayTop >= raisedW) return { kind: 'hold', kg: todayTop }
  return { kind: 'try', kg: raisedW }
}
