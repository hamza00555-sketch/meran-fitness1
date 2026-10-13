// The seeded history the report's browser checks run on (report.e2e.mjs).


// ── Three months of push / pull / legs ────────────────────────
// Four days a week (train, train, rest), January to March 2026. The
// weights climb; in March the lateral raise has held its reps and is
// ready to go up, the squat has stalled twice at 110, and biceps get a
// couple of sets a week. One workout day in March is skipped (the 18th).
// With { deloadEnd: true } the last week of March is a 40% deload.

export const ROT = {
  push: [
    ['Chest', 'Bench Press', 60, 0.6],
    ['Chest', 'Incline Dumbbell Press', 22, 0.25],
    ['Shoulders', 'Lateral Raise', 10, 0],
    ['Triceps', 'Triceps Pushdown', 25, 0.25],
  ],
  pull: [
    ['Back', 'Lat Pulldown', 50, 0.4],
    ['Back', 'Barbell Row', 50, 0.4],
    ['Back', 'Seated Cable Row', 45, 0.3],
    ['Biceps', 'Barbell Curl', 25, 0.15],
  ],
  legs: [
    ['Legs', 'Barbell Squat', 90, 0.5],
    ['Legs', 'Leg Press', 140, 1],
    ['Legs', 'Romanian Deadlift', 70, 0.5],
    ['Legs', 'Leg Extension', 40, 0.3],
  ],
}
export const ORDER = ['push', 'pull', 'legs']
const plate = (w) => Math.round(w / 2.5) * 2.5

export function buildHistory({ deloadEnd = false } = {}) {
  const out = []
  let seq = 0, k = 0, consecutive = 0
  const skip = new Set(['2026-03-18'])
  const DL = { pct: 40, from: '2026-03-25', until: '2026-03-31' }
  const lateral = [[12, 12, 12], [12, 12, 12], [15, 15, 15]]
  let lat = 0
  for (let t = Date.UTC(2026, 0, 1); t <= Date.UTC(2026, 2, 31); t += 86400000) {
    const d = new Date(t)
    const iso = d.toISOString().slice(0, 10)
    if (consecutive >= 2) { consecutive = 0; continue }           // the cycle's rest day
    if (skip.has(iso)) { consecutive = 0; continue }               // a miss restarts the cycle
    consecutive++
    const day = ORDER[k++ % 3]
    const week = Math.floor((t - Date.UTC(2026, 0, 1)) / (7 * 86400000))
    const deload = deloadEnd && iso >= DL.from
    const [y, m, dd] = iso.split('-').map(Number)
    const when = new Date(y, m - 1, dd, 19, 0, 0)
    const exercises = ROT[day].map(([muscle, name, base, step]) => {
      let w = plate(base + step * week * 2.5)
      // Holding the bottom of the range: the engine's verdict is «push»,
      // never «raise» or «lower», unless one of the two cases below.
      let reps = [12, 12, 12]
      if (name === 'Lateral Raise' && iso >= '2026-03-01') { reps = lateral[Math.min(lat++, 2)]; w = 12.5 }
      // The month's last squat sessions all fall short at 110.
      if (name === 'Barbell Squat' && iso >= '2026-03-22' && !deloadEnd) { w = 110; reps = [8, 7, 7] }
      if (deload) w = plate(w * 0.6)
      const sets = (muscle === 'Biceps' ? [reps[0], reps[1]] : reps).map(r => ({ weight: String(w), reps: String(r), done: true }))
      return { id: `e${++seq}`, muscle, name, sets }
    })
    out.push({
      id: when.getTime() + seq,
      date: when.toISOString(),
      duration: 55 + (k % 4) * 5,
      ...(deload ? { deload: DL } : {}),
      exercises,
    })
  }
  return out
}

export const SESSIONS = buildHistory()
export const RECOVERY = {
  daysPerWeek: 4, overrides: [], restDays: [],
  patternHistory: [], streakResetAt: null, autoSpendFrom: null,
  deload: null, deloadHistory: [],
}
export const DELOAD_SESSIONS = buildHistory({ deloadEnd: true })
export const DELOAD_RECOVERY = {
  ...RECOVERY,
  deloadHistory: [{ from: '2026-03-25', plannedUntil: '2026-03-31', until: '2026-03-31', pct: 40, endedEarly: false }],
  deloadEndSeenAt: '2026-03-31',
}
