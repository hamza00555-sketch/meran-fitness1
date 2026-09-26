// ── What counts as a set that happened ────────────────────────
//
// A set counts once it is ticked — nothing else.
//
// The rule used to be "ticked, or has a weight typed in", from before
// the planner pre-filled every set with a suggested weight. Once it
// did, every planned set carried a weight, so an exercise skipped
// entirely was counted as if it had been lifted: a leg day of 7.2 tons
// read 10.1 because three untouched exercises were still sitting in
// the session with their suggestions in them. The set count beside it
// only counted ticks, so the two numbers on one card disagreed.
//
// Its own module so constants.js (achievements, challenges) can use
// the same rule without an import cycle through utils.js.

export const setCounts = (s) => !!s?.done

export const setVolume = (s) =>
  setCounts(s) ? (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0) : 0

export const sessionVolume = (session) =>
  (session?.exercises || []).flatMap(ex => ex.sets || []).reduce((t, s) => t + setVolume(s), 0)

/** The session as it actually happened: unticked sets dropped, and any
 *  exercise left with none dropped with them. Returns null when nothing
 *  was done at all. */
export const keepDone = (session) => {
  const exercises = (session?.exercises || [])
    .map(ex => ({ ...ex, sets: (ex.sets || []).filter(setCounts) }))
    .filter(ex => ex.sets.length > 0)
  return exercises.length ? { ...session, exercises } : null
}
