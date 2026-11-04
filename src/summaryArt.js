// ── The session summary's picture ─────────────────────────────
// «انحفظت الجلسة» opens on a picture of the figure after training, a
// different one each day (Hamza: «كل يوم تجي صورة مختلفة عن الثانية»):
//   · the same picture all day, a second session included;
//   · none comes round again before every one has been shown, and a new
//     round never opens on the picture that closed the last one;
//   · only pictures that can be drawn now are picked (the pack, or its
//     stills online), so nothing is spent on one that cannot show;
//   · and only pictures that light a muscle the session trained (Hamza,
//     on a leg day's summary lighting the back: «الهايلايت على العضلة
//     الخطأ»): a leg day picks among the leg pictures, a pull day among
//     the back ones. Each group's pictures take their own turns.
// The memory is a key of the new design's own (SUMMARY_ART_KEY); the
// old design never reads it.

import { ls } from './utils.js'
import { todayKey } from './day.js'

export const SUMMARY_ART_KEY = 'meran_summary_art'

// A muscle the session leans on: at least this share of its done sets.
const SHARE = 0.2

/**
 * The pictures that fit a session, out of `ids`: those whose lead lit
 * muscle (`lit[id][0]`) is one the session leaned on; failing that,
 * those lighting any muscle it trained; failing that (cardio, core),
 * all of them. `sets`: done sets by muscle group, e.g. { Legs: 12 }.
 */
export function summaryCandidates(ids, sets, lit) {
  const total = Object.values(sets || {}).reduce((a, n) => a + (n > 0 ? n : 0), 0)
  if (!total) return ids
  const leaned = new Set(Object.entries(sets).filter(([, n]) => n / total >= SHARE).map(([g]) => g))
  const lead = ids.filter(id => leaned.has(lit[id]?.[0]))
  if (lead.length) return lead
  const any = ids.filter(id => (lit[id] || []).some(g => sets[g] > 0))
  return any.length ? any : ids
}

/** Done sets by muscle group, for summaryCandidates. */
export function setsByMuscle(session) {
  const out = {}
  for (const ex of session?.exercises || []) {
    const n = (ex.sets || []).filter(s => s?.done).length
    if (n && ex.muscle) out[ex.muscle] = (out[ex.muscle] || 0) + n
  }
  return out
}

/**
 * Today's picture out of `ids` (the ones that can show), and the memory
 * to keep. `rand` is injectable for tests.
 * @returns {{ id: string|null, memory: object|null, changed: boolean }}
 */
export function pickSummaryArt({ today, memory, ids, rand = Math.random }) {
  if (!ids?.length) return { id: null, memory, changed: false }
  const m = memory && typeof memory === 'object' ? memory : {}
  if (m.day === today && ids.includes(m.id)) return { id: m.id, memory, changed: false }

  // `seen` keeps every group's turns; only this group's round restarts
  // when its pictures are spent, never opening on the one that closed it.
  let seen = Array.isArray(m.seen) ? m.seen.filter(x => typeof x === 'string') : []
  let pool = ids.filter(x => !seen.includes(x))
  if (!pool.length) {
    const closed = [...seen].reverse().find(x => ids.includes(x))
    seen = seen.filter(x => !ids.includes(x))
    pool = ids.length > 1 ? ids.filter(x => x !== closed) : ids
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
