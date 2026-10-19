// ── «جديد في مران»: what to show, and when it was seen ────────
//
// The list itself is WHATS_NEW in constants.js (with the rule for adding
// to it). This file decides which entries a launch shows: every one newer
// than the last version seen, newest first — someone back after three
// releases is told about all three, not only the latest.
//
// Where "seen" lives. hf_seen_version is shared with the old design at
// /classic/, which shows its own notice whenever that key is not exactly
// its APP_VERSION, '2.2', and then writes '2.2' back. Writing 3.x there
// would make the two designs show their notices in turn on every switch.
// So the new design keeps its own key, meran_seen_version (the old design
// never reads it), leaves '2.2' in the shared one, and on a phone that
// has no key of its own yet starts from the shared one: a user at 2.2 —
// Hamza, since July — sees everything since 2.2.

import { APP_VERSION, WHATS_NEW } from './constants.js'

export const SEEN_KEY = 'meran_seen_version'
export const CLASSIC_SEEN_KEY = 'hf_seen_version'
export const CLASSIC_VERSION = '2.2'

/** The icons an item may name (each one mapped in components/WhatsNewModal.jsx). */
export const WN_ICONS = [
  'ShieldCheck', 'ArrowsClockwise', 'Sparkle', 'ListChecks', 'ClockCounterClockwise', 'Target',
  'Trophy', 'YoutubeLogo', 'Flame', 'ChartBar', 'Barbell', 'Lightning', 'Medal', 'Image',
  'WifiSlash', 'Palette', 'Notepad', 'Moon', 'Timer', 'Bell', 'Users', 'Repeat',
]
export const WN_TONES = ['', 'streak', 'rest', 'raise']

/** Compares dotted versions as numbers: '3.10' is after '3.9'. */
export function versionCmp(a, b) {
  const pa = String(a ?? '').split('.').map(n => parseInt(n, 10) || 0)
  const pb = String(b ?? '').split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d) return d > 0 ? 1 : -1
  }
  return 0
}

/** The entries after `seen`, up to `current`, newest first. */
export function entriesSince(seen, list = WHATS_NEW, current = APP_VERSION) {
  return list
    .filter(e => versionCmp(e.version, seen || '0') > 0 && versionCmp(e.version, current) <= 0)
    .sort((a, b) => versionCmp(b.version, a.version))
}

/**
 * At launch: what to show (entries, possibly empty) and whether this is a
 * fresh install, which is told nothing and only marked seen. `seenOwn` is
 * meran_seen_version, `seenShared` hf_seen_version.
 */
export function whatsNewAtLaunch({ seenOwn = null, seenShared = null, firstRun = false } = {}) {
  if (firstRun) return { entries: [], markSeen: true }
  const seen = seenOwn || seenShared || '0'
  return { entries: entriesSince(seen), markSeen: false }
}

/** Mark the current version seen, the old design's key left as it reads it. */
export function markWhatsNewSeen(ls) {
  ls.set(SEEN_KEY, APP_VERSION)
  ls.set(CLASSIC_SEEN_KEY, CLASSIC_VERSION)
}
