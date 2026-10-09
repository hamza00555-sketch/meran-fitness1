// ── Shared UI primitives (legacy API, «تحت الأضواء» look) ─────
//
// Every screen that has not been rebuilt on the kit still draws with
// these, so they carry the new design without changing a single prop:
// callers keep passing what they always passed and get a surface-1 card
// with an edge instead of a box with a coloured arc, an eyebrow instead
// of a green bar, a 4px track instead of a glowing bar, a neutral chip
// instead of a tinted pill.
//
// New code should use components/kit — these exist so the old code
// keeps working while it is moved.

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Art from '../assets/Art.jsx'
import { Button, IconButton, Gauge, Num } from './kit/index.jsx'
import { X, Barbell, ClockCounterClockwise, Camera, Trophy, MagnifyingGlass, Notepad } from './kit/icons.js'
import { resolveGlyph, stripEmoji } from './system/glyphs.jsx'
import '../styles/screens/system.css'

const cx = (...a) => a.filter(Boolean).join(' ')

/** Drop undefined/null values before they reach React's style writer:
 *  React writes '' for an undefined longhand, which used to wipe the
 *  card's border on three sides (critique F21). */
function clean(style) {
  if (!style) return undefined
  const out = {}
  for (const k in style) if (style[k] !== undefined && style[k] !== null) out[k] = style[k]
  return out
}

/** A colour the caller passed → a colour role, or null for "not a state".
 *  Only role tokens count: muscle-group hexes and the old decorative
 *  cyan/gold are decoration, and decoration is neutral now. */
function roleOf(color) {
  if (typeof color !== 'string') return null
  if (/--(rest|purple|blue)\b/.test(color)) return 'rest'
  if (/--(streak|orange)\b/.test(color)) return 'streak'
  if (/--raise\b/.test(color)) return 'raise'
  if (/--(danger|red)\b/.test(color)) return 'danger'
  return null
}

// ── Card ──────────────────────────────────────────────────────
// surface-1, a 6% edge, radius 16, padding 16. `topColor` is accepted
// and ignored: the coloured arc it drew is gone (F21). `glass` is the
// raised surface, without the blur.
export function Card({ children, style, onClick, glass = false }) {
  return (
    <div
      onClick={onClick}
      className={cx('sys-card', glass && 'sys-card-raised', onClick && 'sys-card-tap')}
      style={clean(style)}
    >{children}</div>
  )
}

// ── Btn → the kit's Button ────────────────────────────────────
const BTN_VARIANT = { primary: 'primary', secondary: 'secondary', ghost: 'plain', danger: 'destructive' }

export function Btn({ children, onClick, variant = 'primary', disabled = false, style, full = false }) {
  return (
    <Button
      variant={BTN_VARIANT[variant] || 'primary'}
      size="lg"
      full={full}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      style={clean(style)}
    >{children}</Button>
  )
}

// ── Badge → a neutral chip ────────────────────────────────────
// Neutral unless the colour is a role (rest, streak, raise, danger).
// Emoji in the label are dropped: the chip says it in words.
export function Badge({ children, color }) {
  const role = roleOf(color)
  const kids = Array.isArray(children) ? children.map(stripEmoji) : stripEmoji(children)
  return (
    <span className={cx('k-chip', `k-chip-${role || 'neutral'}`, 'sys-chip')}>{kids}</span>
  )
}

// ── Section title: an eyebrow, no bar ─────────────────────────
export function SectionTitle({ children, action }) {
  return (
    <div className="sys-section">
      <h3 className="sys-section-title">{children}</h3>
      {action && <div className="sys-section-action">{action}</div>}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────
// The pack's picture when it is installed; otherwise the caller's image,
// or a Phosphor icon in a quiet disc — never an empty 52px slot (F45)
// and never an emoji.
const ART_ICON = {
  empty_workout: Barbell,
  empty_history: ClockCounterClockwise,
  empty_photos: Camera,
  empty_achievements: Trophy,
  empty_search: MagnifyingGlass,
}

export function EmptyState({ art, icon, img, title, desc }) {
  // The slot's own icon first (it matches the tab it sits in), then the
  // caller's emoji translated, then a neutral page.
  const glyph = resolveGlyph(icon, { fallback: null })
  const Icon = ART_ICON[art] || glyph?.Icon || Notepad
  const fallback = img
    ? <img src={img} alt="" className="sys-empty-art" />
    : <span className="sys-empty-icon"><Icon size={32} weight="regular" aria-hidden="true" /></span>
  return (
    <div className="sys-empty">
      <Art id={art} className="sys-empty-art" fallback={fallback} />
      {title && <p className="sys-empty-title">{title}</p>}
      {desc && <p className="sys-empty-body">{desc}</p>}
    </div>
  )
}

// ── Progress bar → the 4px gauge ──────────────────────────────
// Accent by default; a role colour (rest, streak, raise) is honoured,
// anything else (muscle hexes, the old cyan and decorative gold) reads
// as the accent. `height` and `gradient` are accepted and ignored.
export function ProgressBar({ value = 0, max = 100, color }) {
  const role = roleOf(color)
  const tone = role === 'danger' ? 'accent' : (role || 'accent')
  return <Gauge value={value} max={max} tone={tone} />
}

// ── Rank chip ─────────────────────────────────────────────────
export function RankBadge({ rank }) {
  if (!rank) return null
  return (
    <span className="k-chip k-chip-neutral sys-chip sys-rank">
      {rank.img && <img src={rank.img} alt="" />}
      <Num>{rank.tier}</Num> · {rank.label}
    </span>
  )
}

// ── Overlay (legacy modal) ────────────────────────────────────
// Portalled to <body>, so it can no longer be trapped under the page's
// stacking context with the header over its title (F30). One scrim, no
// blur; align="bottom" is a sheet flush with the bottom edge, top
// corners 16, the safe area respected. Escape closes.
export function Overlay({ children, onClose, align = 'center' }) {
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close.current?.() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [])

  const bottom = align === 'bottom'
  return createPortal(
    <div className={cx('sys-scrim', bottom && 'sys-scrim-bottom')} onClick={() => close.current?.()} role="presentation">
      <div className={cx('sys-panel', bottom && 'sys-panel-bottom')} role="dialog" aria-modal="true"
        onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  )
}

// ── Close button: a 44pt × ────────────────────────────────────
export function CloseBtn({ onClick }) {
  return <IconButton icon={X} label="إغلاق" onClick={onClick} className="sys-close" />
}
