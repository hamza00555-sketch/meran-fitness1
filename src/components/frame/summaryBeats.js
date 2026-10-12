// ── When each part of the workout summary comes in ────────────
//
// Pure, so it can be checked without a browser (tests/medal.test.mjs).
// Beats are BEAT ms apart, in the order on screen: the eyebrow, the
// title, the numbers, then «أعلى وزن», the streak, the level and «تم».
//
// The medals come on a beat of their own right behind the numbers
// (MEDAL_BEAT: ~0.7 s in), not a whole beat after them and never after
// the lines under them: the lines keep the beats they have without any,
// and play alongside the medals' flight.

export const BEAT = 320
export const MEDAL_BEAT = 2.125

/** { eyebrow, title, stats, medals?, prs?, streak, xp, foot } in beats. */
export function summaryBeats({ medals = false, prs = false } = {}) {
  let beat = 0
  const B = {}
  B.eyebrow = beat++; B.title = beat++; B.stats = beat++
  if (medals) B.medals = MEDAL_BEAT
  if (prs) B.prs = beat++
  B.streak = beat++; B.xp = beat++; B.foot = beat++
  return B
}
