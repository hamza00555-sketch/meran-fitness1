// ── Dragging a sheet down to close it: the numbers ────────────
//
// Pure, so tests/sheet-drag.test.mjs can hold them to the plan («اقتراح
// 4»): the sheet follows the finger; let go past a quarter of its height,
// or moving down faster than 0.5px/ms, and it closes — at the finger's
// speed, from where it is; otherwise it springs back. A flick back up
// keeps it open whatever the distance. Pulled up past where it rests, it
// gives like rubber: less and less, never more than RUBBER_LIMIT.
// The DOM side is useSheetDrag (components/kit/useSheetDrag.js).

export const DISMISS_FRACTION = 0.25    // of the sheet's height
export const DISMISS_VELOCITY = 0.5     // px/ms, downwards
export const KEEP_VELOCITY = -0.3       // px/ms: a flick up this fast keeps it open
export const DRAG_SLOP = 6              // px before a touch is a drag
export const RUBBER_LIMIT = 72          // px: the most it ever lifts past the top
export const VELOCITY_WINDOW = 80       // ms of the drag the release speed is read over

/** Where the sheet is drawn for a finger `dy` px below where it started. */
export function rubberBand(dy, limit = RUBBER_LIMIT) {
  if (!(dy < 0)) return Math.max(0, dy || 0)
  const d = -dy
  return -(limit * d) / (d + limit)
}

/**
 * The finger's speed at release, px/ms (down is positive), from samples
 * [{ t, y }] in time order: over the last VELOCITY_WINDOW ms, so a pause
 * before letting go reads as still, and a flick as a flick.
 */
export function releaseVelocity(samples, windowMs = VELOCITY_WINDOW) {
  if (!samples || samples.length < 2) return 0
  const last = samples[samples.length - 1]
  let first = samples[samples.length - 2]
  for (let i = samples.length - 2; i >= 0; i--) {
    first = samples[i]
    if (last.t - samples[i].t >= windowMs) break
  }
  const dt = last.t - first.t
  return dt > 0 ? (last.y - first.y) / dt : 0
}

/** Let go: close (true) or spring back (false)? */
export function shouldDismiss({ dy, vy = 0, height }) {
  if (!(dy > 0)) return false
  if (vy <= KEEP_VELOCITY) return false
  if (vy >= DISMISS_VELOCITY) return true
  return dy >= (height || 0) * DISMISS_FRACTION
}

/**
 * How long the sheet takes to leave from `dy` (it travels the rest of its
 * height): at the finger's speed, never slower than a quick exit nor
 * faster than the eye can follow.
 */
export function exitDuration({ dy, height, vy = 0 }) {
  const rest = Math.max(0, (height || 0) - Math.max(0, dy || 0))
  return Math.round(Math.min(260, Math.max(120, rest / Math.max(vy, 1.2))))
}
