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

export const CalendarIcon = ({ size = 18, color = '#00D4C8' }) => (
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
