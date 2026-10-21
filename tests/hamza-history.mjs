// A history like حمزة's on the day the rest-day rules changed.
//
// Four days a week (two on, one off) from 24 August 2026; nine workout
// days covered by an optional rest day, the last three on 5, 12 and 19
// October. On 20 October, before training, the sheet read exactly what
// he saw: 48 days «من 24 أغسطس · 32 تمرين + 16 راحة مجدولة», «ليش مو 58؟»,
// no rest day held, 3 of 5 toward the next. He trained on the 20th.
//
// Used by tests/deload.e2e.mjs and tests/design-switch.e2e.mjs to look at
// 21 October and after, under the new rules (one every 3, at most 5).

import { computeRecovery, addDays } from '../src/recovery.js'

const ANCHORS = ['2026-08-30', '2026-09-05', '2026-09-11', '2026-09-17', '2026-09-23', '2026-09-29', '2026-10-05', '2026-10-12', '2026-10-19']

const session = (iso, i) => {
  const d = new Date(`${iso}T18:00:00+03:00`)
  return {
    id: d.getTime() + i, date: d.toISOString(), duration: 60,
    exercises: [{ id: `h${i}`, muscle: 'Chest', name: 'Bench Press', sets: [{ weight: '80', reps: '10', done: true }] }],
  }
}

export const HAMZA_RECOVERY = {
  daysPerWeek: 4, overrides: [], restDays: [], patternHistory: [], streakResetAt: null,
  autoSpendFrom: '2026-08-01', deload: null, deloadHistory: [], deloadSuggestDismissedAt: null,
}

/**
 * { sessions, recovery } trained through `through` (inclusive), keeping
 * to the plan after 20 Oct. The paid days are in restDays, as the app
 * writes them.
 */
export function hamzaHistory(through = '2026-10-20') {
  const sessions = []
  const paid = []
  let a = 0
  for (let d = '2026-08-24'; d <= through; d = addDays(d, 1)) {
    const r = computeRecovery(sessions, { ...HAMZA_RECOVERY, restDays: paid }, d)
    if (r.status !== 'workout') continue
    if (a < ANCHORS.length && d >= ANCHORS[a] && r.usableCredits >= 1) { paid.push(d); a++; continue }
    sessions.push(session(d, sessions.length))
  }
  return { sessions, recovery: { ...HAMZA_RECOVERY, restDays: paid } }
}
