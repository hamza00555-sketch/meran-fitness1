// ── Timing marks, off unless asked for ────────────────────────
//
// `localStorage.meran_perf = '1'` (or `?perf` in the address) turns on
// performance.mark()s along the medal's path — the summary opening, the
// medal module, each step of building the stage, the first frame, the
// landings — so a browser test or Safari's Web Inspector can read the
// timeline (performance.getEntriesByType('mark')). Off, a mark is one
// boolean test.

let on = false
try {
  on = localStorage.getItem('meran_perf') === '1' || /[?&]perf\b/.test(location.search)
} catch { on = false }

export const perfOn = () => on

/** performance.mark(`meran:${name}`), once per name unless `again`. */
const done = new Set()
export function mark(name, again = false) {
  if (!on) return
  if (!again && done.has(name)) return
  done.add(name)
  try { performance.mark(`meran:${name}`) } catch { /* old Safari */ }
}

/** Forget the once-only names (a new summary is a new timeline). */
export function resetMarks() {
  if (!on) return
  done.clear()
  try { performance.clearMarks() } catch { /* old Safari */ }
}
