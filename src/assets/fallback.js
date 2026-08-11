// ── Bundled vector fallbacks ──────────────────────────────────
// The ids listed here never render as an emoji, even on a fresh
// install with no network — they resolve to an inline SVG that
// ships in the JS bundle (~4KB gzipped for the lot).
//
// They are deliberately the high-traffic slots: alerts, nav, the
// streak chrome, the workout controls. The rest of the pack — the
// achievement and muscle art, the greeting glyphs — falls back to
// emoji until the download completes, because shipping eighty more
// vectors in the bundle would defeat the point of hosting the art
// externally.
//
// These are NOT in public/: workbox precaches everything there, and
// each file would then compete for the same storage quota the pack
// itself needs.

import {
  FlameIcon, StarIcon, TrophyIcon, LockIcon, CalendarIcon, BossIcon,
  LightningIcon, TrashIcon, BellIcon, EditIcon, SettingsIcon, ScaleIcon,
  TargetIcon, PersonIcon, HomeIcon, DumbbellIcon, FlagIcon, ExportIcon,
  CheckIcon, WarnIcon, InfoIcon, PlayIcon, PauseIcon, SkipIcon, SaveIcon,
  PartyIcon, MapIcon, MoonIcon, TicketIcon, BoxIcon, CrownIcon, SwapIcon,
  CameraIcon, ClockIcon, BookIcon,
} from '../components/Icons.jsx'

export const FALLBACK_SVG = {
  // alerts
  check:      CheckIcon,
  warn:       WarnIcon,
  save:       SaveIcon,
  party:      PartyIcon,
  map:        MapIcon,
  skip:       SkipIcon,
  ticket:     TicketIcon,
  clipboard:  BookIcon,
  star:       StarIcon,
  trophy:     TrophyIcon,
  flex:       DumbbellIcon,

  // streak & progress chrome
  flame:      FlameIcon,
  crown:      CrownIcon,
  box:        BoxIcon,
  lock:       LockIcon,
  moon:       MoonIcon,
  scale:      ScaleIcon,
  core:       TargetIcon,

  // nav & structure
  house:      HomeIcon,
  swords:     FlagIcon,
  books:      BookIcon,
  person:     PersonIcon,
  people:     PersonIcon,
  gear:       SettingsIcon,
  bell:       BellIcon,

  // workout controls
  play:       PlayIcon,
  pause:      PauseIcon,
  info:       InfoIcon,
  stopwatch:  ClockIcon,
  clock:      ClockIcon,
  clock3:     ClockIcon,
  pencil:     EditIcon,
  trash:      TrashIcon,
  swap:       SwapIcon,
  camera:     CameraIcon,
  camera_flash: CameraIcon,
  inbox:      ExportIcon,
  calendar:   CalendarIcon,
  calendar_days: CalendarIcon,
  calendar_spiral: CalendarIcon,
  bolt:       LightningIcon,
  ogre:       BossIcon,
  lifter:     DumbbellIcon,
}

export const hasFallback = (id) => !!FALLBACK_SVG[id]
