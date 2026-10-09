// ── Legacy icon names, drawn by Phosphor ──────────────────────
//
// The design has one icon family (critique: iconsAr — "Icons.jsx is
// replaced, not extended"). These names and props stay exactly as they
// were, so every caller keeps working, but each one now draws its
// Phosphor counterpart: same geometry, same round joins, same stroke
// as the rest of the app. Filled marks (flame, star, bolt, drop) use
// the fill weight; outline marks the regular weight, or fill when the
// caller asks for `filled`.
//
// The colour goes through CSS `color` (the icon paints currentColor),
// so a token like var(--cyan) always resolves.
//
// New code: import from ./kit/icons.js directly.

import {
  User, Trophy, Flag, Barbell, House, Flame, Drop, Star, Lightning, CalendarBlank,
  Crown, LockSimple, PencilSimple, CaretLeft, CaretRight, CaretDown, Scales, Ruler,
  Hourglass, Target, ChartBar, GearSix, Trash, DownloadSimple, Bell,
} from '@phosphor-icons/react'

function wrap(Icon, { defaultSize = 24, defaultColor = 'currentColor', weight = 'regular', filledWeight = 'fill' } = {}) {
  function LegacyIcon({ size = defaultSize, color = defaultColor, filled = false }) {
    return (
      <Icon
        size={size}
        weight={filled ? filledWeight : weight}
        style={{ color, flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}
        aria-hidden="true"
      />
    )
  }
  LegacyIcon.displayName = `Legacy(${Icon.displayName || 'Icon'})`
  return LegacyIcon
}

export const PersonIcon   = wrap(User)
export const TrophyIcon   = wrap(Trophy)
export const FlagIcon     = wrap(Flag)
export const DumbbellIcon = wrap(Barbell)
export const HomeIcon     = wrap(House)

export const FlameIcon    = wrap(Flame,     { defaultSize: 20, defaultColor: 'var(--streak)', weight: 'fill' })
// The deload counterpart to the flame: same meter, read as water.
export const DropletIcon  = wrap(Drop,      { defaultSize: 20, defaultColor: 'var(--cyan)',   weight: 'fill' })
export const StarIcon     = wrap(Star,      { defaultSize: 16, defaultColor: 'var(--ink-2)',  weight: 'fill' })
export const LightningIcon = wrap(Lightning, { defaultSize: 18, defaultColor: 'var(--accent)', weight: 'fill' })
export const CalendarIcon = wrap(CalendarBlank, { defaultSize: 18, defaultColor: 'var(--rest)' })
export const BossIcon     = wrap(Crown,     { defaultSize: 18, defaultColor: 'var(--ink-2)',  weight: 'fill' })
export const LockIcon     = wrap(LockSimple, { defaultSize: 18, defaultColor: 'var(--ink-3)' })
export const EditIcon     = wrap(PencilSimple, { defaultSize: 16 })

const CHEVRON = { left: CaretLeft, right: CaretRight, down: CaretDown }
export function ChevronIcon({ size = 16, color = 'currentColor', dir = 'left' }) {
  const Icon = CHEVRON[dir] || CaretLeft
  return <Icon size={size} weight="bold" style={{ color, flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }} aria-hidden="true" />
}

export const WeightIcon   = wrap(Scales)
export const HeightIcon   = wrap(Ruler)
export const BodyFatIcon  = wrap(Drop)
export const AgeIcon      = wrap(Hourglass)
export const TargetIcon   = wrap(Target)
export const SystemIcon   = wrap(ChartBar)
export const SettingsIcon = wrap(GearSix)
export const TrashIcon    = wrap(Trash)
export const ExportIcon   = wrap(DownloadSimple)
export const BellIcon     = wrap(Bell)
export const ScaleIcon    = wrap(Scales)
