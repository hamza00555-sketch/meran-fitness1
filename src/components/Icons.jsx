// SVG Icon components — clean line-art style like the reference app

export const PersonIcon = ({ size = 24, color = 'currentColor', filled = false }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={filled ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    {filled ? (
      <>
        <circle cx="12" cy="7" r="4" fill={color} />
        <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" fill={color} />
      </>
    ) : (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
      </>
    )}
  </svg>
)

export const TrophyIcon = ({ size = 24, color = 'currentColor', filled = false }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 21h8M12 17v4" stroke={color} />
    <path d="M7 3H17L16.5 9A4.5 4.5 0 0112 13.5 4.5 4.5 0 017.5 9L7 3z" fill={filled ? color : 'none'} />
    <path d="M7 6H4a2 2 0 000 4c.7 2 2 3.5 3.5 4" />
    <path d="M17 6h3a2 2 0 010 4c-.7 2-2 3.5-3.5 4" />
  </svg>
)

export const FlagIcon = ({ size = 24, color = 'currentColor', filled = false }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 21V5" />
    <path d="M5 5l14 4-14 4" fill={filled ? color : 'none'} />
  </svg>
)

export const DumbbellIcon = ({ size = 24, color = 'currentColor', filled = false }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="10" width="3" height="4" rx="1" />
    <rect x="19" y="10" width="3" height="4" rx="1" />
    <rect x="5" y="7" width="3" height="10" rx="1" />
    <rect x="16" y="7" width="3" height="10" rx="1" />
    <line x1="8" y1="12" x2="16" y2="12" strokeWidth={2.5} />
  </svg>
)

export const HomeIcon = ({ size = 24, color = 'currentColor', filled = false }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12L12 4l9 8" />
    <path
      d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"
      fill={filled ? color : 'none'}
    />
  </svg>
)

export const FlameIcon = ({ size = 20, color = '#F97316' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2c0 0-4 4-4 9a4 4 0 004 4 4 4 0 004-4c0-2-.8-4-2-5.5 0 2-1 3.5-2 4.5C12.7 8.5 12 5.5 12 2z" />
    <path d="M12 22a6 6 0 006-6c0-3.3-2-5.5-4-7 .5 2-.5 4-2 5a2 2 0 01-2-2c-1 1.5-1.5 3-1.5 4a5.5 5.5 0 003.5 5.9 6 6 0 000-.1" />
  </svg>
)

export const StarIcon = ({ size = 16, color = '#EAB308' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
)

export const LightningIcon = ({ size = 18, color = '#22C55E' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
)

export const CalendarIcon = ({ size = 18, color = '#3B9DE8' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

export const BossIcon = ({ size = 18, color = '#EF4444' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2L8 8H2l5 4-2 7 7-4 7 4-2-7 5-4h-6L12 2z" />
  </svg>
)

export const LockIcon = ({ size = 18, color = '#4B5563' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 018 0v4" />
  </svg>
)

export const EditIcon = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

export const ChevronIcon = ({ size = 16, color = 'currentColor', dir = 'left' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: dir === 'right' ? 'rotate(180deg)' : dir === 'down' ? 'rotate(270deg)' : 'rotate(0deg)' }}
  >
    <path d="M15 18l-6-6 6-6" />
  </svg>
)

export const WeightIcon = ({ size=24, color='currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4v4M6 16v4M18 4v4M18 16v4M3 8h6M15 8h6M3 16h6M15 16h6M9 12h6" strokeWidth={2.2}/>
    <rect x="5" y="7" width="4" height="10" rx="1.5" fill={color} fillOpacity="0.2"/>
    <rect x="15" y="7" width="4" height="10" rx="1.5" fill={color} fillOpacity="0.2"/>
  </svg>
)

export const HeightIcon = ({ size=24, color='currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="2" x2="12" y2="22"/>
    <polyline points="8 6 12 2 16 6"/>
    <polyline points="8 18 12 22 16 18"/>
    <line x1="5" y1="12" x2="19" y2="12" strokeWidth={1} strokeDasharray="2 2"/>
  </svg>
)

export const BodyFatIcon = ({ size=24, color='currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a5 5 0 015 5c0 5-5 13-5 13S7 13 7 8a5 5 0 015-5z" fill={color} fillOpacity="0.15"/>
    <path d="M12 3a5 5 0 015 5c0 5-5 13-5 13S7 13 7 8a5 5 0 015-5z"/>
    <circle cx="12" cy="8" r="2" fill={color} fillOpacity="0.4"/>
  </svg>
)

export const AgeIcon = ({ size=24, color='currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <polyline points="12 6 12 12 16 14"/>
    <circle cx="12" cy="12" r="1" fill={color}/>
  </svg>
)

export const TargetIcon = ({ size=24, color='currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="12" r="5"/>
    <circle cx="12" cy="12" r="1" fill={color}/>
  </svg>
)

export const SystemIcon = ({ size=24, color='currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
    <line x1="7" y1="8" x2="7" y2="12"/>
    <line x1="12" y1="6" x2="12" y2="12"/>
    <line x1="17" y1="9" x2="17" y2="12"/>
  </svg>
)

export const SettingsIcon = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
)

export const TrashIcon = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>
)

export const ExportIcon = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

export const BellIcon = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
)

export const ScaleIcon = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l4 8H8l4-8z"/>
    <path d="M4 19l3-8H1l3 8zM23 19l-3-8h-6l3 8z"/>
    <line x1="2" y1="19" x2="22" y2="19"/>
    <line x1="12" y1="3" x2="12" y2="19"/>
  </svg>
)

// ── Fallback set for the icon pack ────────────────────────────
// These back the ids that appear constantly — alerts, nav, streak
// chrome. Because they ship in the bundle, those slots never show a
// raw emoji, even on a fresh install with no network. The rest of
// the pack falls back to emoji until it downloads. See Ico.jsx.

const line = (color, w = 1.8) => ({
  fill: 'none', stroke: color, strokeWidth: w,
  strokeLinecap: 'round', strokeLinejoin: 'round',
})

export const CheckIcon = ({ size = 20, color = '#5EC32A' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...line(color, 2.4)}>
    <path d="M4 12.5l5.5 5.5L20 6" />
  </svg>
)

export const WarnIcon = ({ size = 20, color = '#F59E0B' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...line(color, 2)}>
    <path d="M12 3.5L22 20H2L12 3.5z" />
    <line x1="12" y1="10" x2="12" y2="14" />
    <circle cx="12" cy="17" r="0.9" fill={color} stroke="none" />
  </svg>
)

export const InfoIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...line(color, 2)}>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="11" x2="12" y2="16.5" />
    <circle cx="12" cy="7.6" r="0.9" fill={color} stroke="none" />
  </svg>
)

export const PlayIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M7 4.5l12 7.5-12 7.5v-15z" />
  </svg>
)

export const PauseIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <rect x="6" y="4.5" width="4" height="15" rx="1.2" />
    <rect x="14" y="4.5" width="4" height="15" rx="1.2" />
  </svg>
)

export const SkipIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M5 5l9 7-9 7V5z" />
    <rect x="16" y="5" width="3" height="14" rx="1.2" />
  </svg>
)

export const SaveIcon = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...line(color)}>
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <path d="M17 21v-8H7v8M7 3v5h8" />
  </svg>
)

export const PartyIcon = ({ size = 20, color = '#F59E0B' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...line(color, 2)}>
    <path d="M3 21l5.5-13L18 17.5 3 21z" />
    <path d="M14 3.5v2M19.5 6l-1.4 1.4M21 12h-2" />
  </svg>
)

export const MapIcon = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...line(color)}>
    <path d="M9 4L3 6.5v14L9 18l6 2.5 6-2.5v-14L15 6.5 9 4z" />
    <line x1="9" y1="4" x2="9" y2="18" />
    <line x1="15" y1="6.5" x2="15" y2="20.5" />
  </svg>
)

export const MoonIcon = ({ size = 20, color = '#3B9DE8' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 108.4 12.9c.7-.3 1.4-.9 2.1-2.4z" />
  </svg>
)

export const TicketIcon = ({ size = 20, color = '#5EC32A' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...line(color)}>
    <path d="M3 9V6.5A1.5 1.5 0 014.5 5h15A1.5 1.5 0 0121 6.5V9a3 3 0 000 6v2.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5V15a3 3 0 000-6z" />
    <line x1="14" y1="5" x2="14" y2="19" strokeDasharray="2 2.5" />
  </svg>
)

export const BoxIcon = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...line(color)}>
    <path d="M21 8l-9-5-9 5 9 5 9-5z" />
    <path d="M3 8v8l9 5 9-5V8" />
    <line x1="12" y1="13" x2="12" y2="21" />
  </svg>
)

export const CrownIcon = ({ size = 20, color = '#F59E0B' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M3 18h18l1.5-11-5.5 4-4.5-7-4.5 7L2 7l1 11z" />
  </svg>
)

export const SwapIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...line(color, 2)}>
    <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />
  </svg>
)

export const CameraIcon = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...line(color)}>
    <path d="M3 8.5A1.5 1.5 0 014.5 7h2.7l1.4-2h6.8l1.4 2h2.7A1.5 1.5 0 0121 8.5v9A1.5 1.5 0 0119.5 19h-15A1.5 1.5 0 013 17.5v-9z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
)

export const ClockIcon = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...line(color)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.5l3.5 2" />
  </svg>
)

export const BookIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...line(color)}>
    <path d="M4 4.5A1.5 1.5 0 015.5 3H19v16H5.5A1.5 1.5 0 004 20.5v-16z" />
    <path d="M4 20.5A1.5 1.5 0 015.5 19H19v2H5.5A1.5 1.5 0 014 20.5z" />
  </svg>
)
