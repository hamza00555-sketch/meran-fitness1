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

/** A set with a real weight and rep count typed into it. */
const hasNumbers = (s) => parseFloat(s?.weight) > 0 && parseInt(s?.reps) > 0

/** The session as it actually happened. Returns null only when there is
 *  nothing in it at all.
 *
 *  A saved session is never discarded for want of ticks: saving it means
 *  the person went and trained, and the consistency streak is built from
 *  exactly that. The first version of this function dropped every
 *  session with no ticked set, on the theory that "not ticked" meant
 *  "not done" — but the app has always let a workout be finished by
 *  typing the numbers and pressing «إنهاء التمرين» without ticking, and a
 *  month of sessions logged that way vanished, taking a 30-day streak
 *  down to 6. So the rule reads the session's own habit:
 *
 *   - Some set ticked → this session uses the tick. Unticked sets are the
 *     planner's suggestions for exercises that were skipped; drop them.
 *   - Nothing ticked → the session was logged without ticks. Every set
 *     with a weight and reps in it IS the workout; mark it done. Empty
 *     sets go. */
export const normalizeSession = (session) => {
  const all = (session?.exercises || []).flatMap(ex => ex.sets || [])
  const usesTicks = all.some(setCounts)
  const exercises = (session?.exercises || [])
    .map(ex => ({
      ...ex,
      sets: usesTicks
        ? (ex.sets || []).filter(setCounts)
        : (ex.sets || []).filter(hasNumbers).map(s => ({ ...s, done: true })),
    }))
    .filter(ex => ex.sets.length > 0)
  return exercises.length ? { ...session, exercises } : null
}

// The earlier name, kept so nothing importing it breaks.
export const keepDone = normalizeSession
