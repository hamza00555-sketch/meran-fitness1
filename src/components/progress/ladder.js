import { RANKS } from '../../constants.js'
import { getRank } from '../../utils.js'

/** Where a level stands on the rank ladder E → S+, 0–1: the run fills to
 *  the current rank's node, plus the share of the way to the next one. */
export function ladderFill(level) {
  const rank = getRank(level)
  const idx = Math.max(0, RANKS.findIndex(r => r.tier === rank.tier))
  const next = RANKS[idx + 1]
  const within = next ? Math.max(0, Math.min(1, (level - rank.minLevel) / (next.minLevel - rank.minLevel))) : 0
  return (idx + within) / (RANKS.length - 1)
}

/** Did going from level `before` to `level` open a new rank? Also when a
 *  session jumped several levels and went past a rank's first level
 *  (4 → 6 opens D), not only when it landed exactly on it. */
export function reachedNewRank(before, level) {
  return level > 1 && level > before && getRank(Math.max(1, before)).tier !== getRank(level).tier
}
