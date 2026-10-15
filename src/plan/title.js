// ── A plan's name, as the app prints it ───────────────────────
//
// A plan is copied whole into his phone's storage when he starts it, name
// and all, so a built-in plan's name stays as it was spelt that day. The
// machines plan shipped as «خطة المبتدأ» (the hamza on the alef, a typo
// for «المبتدئ»); src/constants.js has it right now, and this prints it
// right on every phone that stored the old spelling — without rewriting
// his stored plan, which the old design (classic/) reads too.

const FIXES = [
  [/المبتدأ/g, 'المبتدئ'],
]

/** The plan's name for display: the stored name with known typos fixed. */
export function planTitle(name) {
  let s = String(name ?? '')
  for (const [re, to] of FIXES) s = s.replace(re, to)
  return s
}
