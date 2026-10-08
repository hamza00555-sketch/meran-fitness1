import { Flame, BADGES } from './StreakIcons.jsx'

// ── The streak in the header ──────────────────────────────────
// A real button now, not a div: it takes you to the scoreboard. The
// flame is filled once today counts and an outline while today is
// still owed, so the same «10» no longer looks identical when it is
// safe and when it is one night from zero. At 0 the number stays,
// drawn as an outline, instead of the chip quietly disappearing.

export default function StreakChip({ view, onOpen }) {
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
        {Badge && <span className={`streak-chip-badge ${view.badgeTone}`}><Badge size={9} /></span>}
      </span>
      <b className={view.number === 0 ? 'zero' : ''}>{view.number}</b>
    </button>
  )
}
