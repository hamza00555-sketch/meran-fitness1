import { Flame, BADGES } from './StreakIcons.jsx'
import { streakView } from '../../streak.js'
import useMinute from './useMinute.js'

// ── The streak in the header ──────────────────────────────────
// A real button now, not a div: it takes you to the scoreboard. The
// flame is filled once today counts and an outline while today is
// still owed, so the same «10» no longer looks identical when it is
// safe and when it is one night from zero. At 0 the number stays,
// dimmed, instead of the chip quietly disappearing.

// It keeps its own minute clock so the 23:00 warning reaches it on
// every tab, not only when something else happens to re-render.
export default function StreakChip({ recovery, config, active, deload, today, onOpen }) {
  const now = useMinute()
  const view = streakView({ recovery, config, active, deload, now, today })
  const Badge = view.badge ? BADGES[view.badge] : null
  return (
    <button
      type="button"
      className={`streak-chip${view.counted ? ' counted' : ''}${view.statusWarn ? ' warn' : ''}`}
      onClick={onOpen}
      aria-label={view.aria}
      data-testid="streak-chip"
    >
      <span className="streak-chip-flame">
        <Flame size={16} filled={view.counted} />
        {Badge && <span className={`streak-chip-badge ${view.badgeTone}`}><Badge size={7} /></span>}
      </span>
      <b className={view.number === 0 ? 'zero' : ''}>{view.number}</b>
    </button>
  )
}
