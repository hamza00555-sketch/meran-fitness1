// ── Which medals spin, in what order, and how each one lands ──
//
// Pure decisions for MedalReveal.jsx, kept apart so they can be tested
// without a browser (tests/medal.test.mjs).
//
//   medalQueue(list)   one medal: it spins. Two: the rarer one first, the
//                      second waits for it to land, then they stand side by
//                      side. Three or more (rare): the two rarest spin and
//                      the rest sit in a small row under them. Equal rarity
//                      keeps the order they were earned in. A medal earned
//                      twice (an award counted twice) shows once.
//   landingFeel(r)     the sound and the buzz as a medal lands: the light
//                      clink for a common one, the bell (medal-heavy) from
//                      rare up — the sound library's own split — and the
//                      stronger pulse only for epic and legendary, the two
//                      that land heavy on screen too.
//   revealMode(o)      how the medal is drawn: 'spin' (WebGL), 'fade' (the
//                      phone asks for less motion: no spin, a fade), 'flat'
//                      (no WebGL, or it was lost: the app's flat medal with a
//                      CSS turn), 'flat-fade' (both).

export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary']

export const rarityRank = (r) => Math.max(0, RARITY_ORDER.indexOf(r || 'common'))

export function medalQueue(list = []) {
  const seen = new Set()
  const unique = []
  for (const a of list) {
    if (!a || seen.has(a.id)) continue
    seen.add(a.id)
    unique.push(a)
  }
  const ordered = unique
    .map((a, i) => ({ a, i }))
    .sort((x, y) => (rarityRank(y.a.rarity) - rarityRank(x.a.rarity)) || (x.i - y.i))
    .map(x => x.a)
  return { stage: ordered.slice(0, 2), rest: ordered.slice(2) }
}

export function landingFeel(rarity) {
  const r = rarityRank(rarity)
  return {
    sound: r >= 1 ? 'medal-heavy' : 'medal',
    haptic: r >= 2 ? 'medal-heavy' : 'medal',
  }
}

/** The heaviest landing among several (a skip lands them all at once: one sound, not two). */
export function heaviestFeel(rarities = []) {
  const top = rarities.reduce((m, r) => Math.max(m, rarityRank(r)), 0)
  return landingFeel(RARITY_ORDER[top])
}

export function revealMode({ webgl = true, reduced = false } = {}) {
  if (!webgl) return reduced ? 'flat-fade' : 'flat'
  return reduced ? 'fade' : 'spin'
}
