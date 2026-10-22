// ── The session summary's picture ─────────────────────────────
// «انحفظت الجلسة» opens on a picture of the figure after training, a
// different one each day (Hamza: «كل يوم تجي صورة مختلفة عن الثانية»):
//   · the same picture all day, a second session included;
//   · none comes round again before every one has been shown, and a new
//     round never opens on the picture that closed the last one;
//   · only pictures that can be drawn now are picked (the pack, or its
//     stills online), so nothing is spent on one that cannot show.
// The memory is a key of the new design's own (SUMMARY_ART_KEY); the
// old design never reads it.

import { ls } from './utils.js'
import { todayKey } from './day.js'

export const SUMMARY_ART_KEY = 'meran_summary_art'

/**
 * Today's picture out of `ids` (the ones that can show), and the memory
 * to keep. `rand` is injectable for tests.
 * @returns {{ id: string|null, memory: object|null, changed: boolean }}
 */
export function pickSummaryArt({ today, memory, ids, rand = Math.random }) {
  if (!ids?.length) return { id: null, memory, changed: false }
  const m = memory && typeof memory === 'object' ? memory : {}
  if (m.day === today && ids.includes(m.id)) return { id: m.id, memory, changed: false }

  let seen = Array.isArray(m.seen) ? m.seen.filter(x => ids.includes(x)) : []
  let pool = ids.filter(x => !seen.includes(x))
  if (!pool.length) {
    seen = []
    pool = ids.length > 1 ? ids.filter(x => x !== m.id) : ids
  }
  const id = pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))]
  return { id, memory: { day: today, id, seen: [...seen, id] }, changed: true }
}

/** Today's picture for the summary, remembered for the day. */
export function summaryArtToday(ids) {
  const out = pickSummaryArt({ today: todayKey(), memory: ls.get(SUMMARY_ART_KEY, null), ids })
  if (out.changed) ls.set(SUMMARY_ART_KEY, out.memory)
  return out.id
}
