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

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Art from '../assets/Art.jsx'
import { Button, IconButton, Gauge, Num } from './kit/index.jsx'
import { X, Barbell, ClockCounterClockwise, Camera, Trophy, MagnifyingGlass, Notepad } from './kit/icons.js'
import { resolveGlyph, stripEmoji } from './system/glyphs.jsx'
import '../styles/screens/system.css'
import { lockScroll } from '../scrollLock.js'

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

// ── Overlay (legacy modal) → the kit's sheet ──────────────────
// Same API (children, onClose, align), same behaviour as the kit Sheet
// so the two can no longer be told apart (F30):
//   · portalled to <body>, one scrim, top corners 16, a grabber;
//   · the page behind is inert and does not scroll; focus moves into
//     the sheet and goes back to whatever opened it;
//   · a real way out: a scrim tap, Escape or the CloseBtn inside it
//     plays the exit (200ms, --ease-exit) and only then calls onClose.
// align="center" keeps a centred panel for any caller that asks for it.
const EXIT_MS = 200
const OverlayCtx = createContext(null)

export function Overlay({ children, onClose, align = 'center' }) {
  const [leaving, setLeaving] = useState(false)
  const [opener] = useState(() => (typeof document !== 'undefined' ? document.activeElement : null))
  const panelRef = useRef(null)
  const close = useRef(onClose)
  close.current = onClose
  const busy = useRef(false)
  const alive = useRef(true)
  const timers = useRef([])

  // Leave, then hand over to the caller's handler (the CloseBtn's own
  // onClick, or onClose). If the caller keeps us mounted, come back.
  const requestClose = useCallback((handler) => {
    if (busy.current) return
    busy.current = true
    setLeaving(true)
    const ms = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : EXIT_MS
    timers.current.push(setTimeout(() => {
      ;(handler || close.current)?.()
      timers.current.push(setTimeout(() => {
        if (!alive.current) return
        busy.current = false
        setLeaving(false)
      }, 60))
    }, ms))
  }, [])

  useEffect(() => {
    alive.current = true
    const release = lockScroll({ inert: true })
    // Into the sheet — unless a field inside it already took focus.
    const panel = panelRef.current
    if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true })
    const onKey = (e) => { if (e.key === 'Escape') requestClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      alive.current = false
      timers.current.forEach(clearTimeout)
      window.removeEventListener('keydown', onKey)
      release()
      if (opener && opener.isConnected) opener.focus?.({ preventScroll: true })
    }
  }, [opener, requestClose])

  const bottom = align === 'bottom'
  return createPortal(
    <OverlayCtx.Provider value={requestClose}>
      <div className={cx('sys-scrim', bottom && 'sys-scrim-bottom', leaving && 'is-leaving')}
        onClick={() => requestClose()} role="presentation">
        <div ref={panelRef} tabIndex={-1}
          className={cx('sys-panel', bottom && 'sys-panel-bottom', leaving && 'is-leaving')}
          role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
          {bottom && <span className="k-sheet-grab" aria-hidden="true" />}
          {children}
        </div>
      </div>
    </OverlayCtx.Provider>,
    document.body,
  )
}

// ── Close button: a 44pt × ────────────────────────────────────
// Inside an Overlay it asks the Overlay to leave first, then runs its
// own onClick — the sheet slides away instead of vanishing in a frame.
export function CloseBtn({ onClick }) {
  const requestClose = useContext(OverlayCtx)
  const handle = requestClose ? () => requestClose(onClick) : onClick
  return <IconButton icon={X} label="إغلاق" onClick={handle} className="sys-close" />
}
