// ── The component kit for the new design ──────────────────────
//
// One recipe per role, so the twelve button recipes, six ways of showing
// a selection and five kinds of notice the critique found collapse into
// these. Styles are classes in src/styles/kit.css, written against the
// tokens in src/styles/tokens.css; inline styles are for values that
// change at runtime only.
//
// Rules the kit enforces by construction:
//   · one green fill per screen — only <Button variant="primary">
//   · 44pt minimum tap target (IconButton pads to it)
//   · numbers and Latin runs are isolated LTR (<Num>), so «4,200 XP»
//     never prints backwards inside an Arabic line
//   · no emoji in chrome; icons come from ./icons.js

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CaretLeft, CaretRight, X } from './icons.js'

const cx = (...a) => a.filter(Boolean).join(' ')

// ── Numbers ───────────────────────────────────────────────────
/** A number or Latin run, isolated LTR, tabular. */
export function Num({ children, className, style }) {
  return <bdi dir="ltr" className={cx('k-num', className)} style={style}>{children}</bdi>
}

/** «77.5 كجم» — the number in the numeric face, the unit after it. */
export function Weight({ kg, unit = 'كجم', className }) {
  const v = typeof kg === 'number' ? (Number.isInteger(kg) ? kg : +kg.toFixed(2)) : kg
  return <span className={cx('k-weight', className)}><Num>{v}</Num><span className="k-unit"> {unit}</span></span>
}

// ── Buttons ───────────────────────────────────────────────────
/**
 * variant: primary (the one green fill) · secondary (neutral fill) ·
 *          plain (text only) · destructive (red text; filled only inside
 *          ConfirmSheet)
 * size:    lg 56 · md 44 · sm 36
 */
export function Button({ variant = 'secondary', size = 'md', icon: Icon, full, className, children, ...rest }) {
  return (
    <button type="button" className={cx('k-btn', `k-btn-${variant}`, `k-btn-${size}`, full && 'k-full', className)} {...rest}>
      {Icon && <Icon size={size === 'sm' ? 16 : 20} weight="bold" aria-hidden="true" />}
      {children != null && <span>{children}</span>}
    </button>
  )
}

/** An icon-only button with a 44pt target and a required label. */
export function IconButton({ icon: Icon, label, variant = 'ghost', size = 44, iconSize, weight = 'regular', mirrored, className, ...rest }) {
  return (
    <button type="button" aria-label={label} title={label}
      className={cx('k-iconbtn', `k-iconbtn-${variant}`, className)}
      style={{ width: size, height: size }} {...rest}>
      <Icon size={iconSize || (size >= 52 ? 26 : 22)} weight={weight} mirrored={mirrored} aria-hidden="true" />
    </button>
  )
}

// ── Chips and selection ───────────────────────────────────────
/** tone: neutral (default) · accent · raise · streak · rest · danger. */
export function Chip({ tone = 'neutral', selected, icon: Icon, onClick, className, children, ...rest }) {
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick}
      aria-pressed={onClick ? !!selected : undefined}
      className={cx('k-chip', `k-chip-${tone}`, selected && 'k-chip-on', className)} {...rest}>
      {Icon && <Icon size={14} weight="bold" aria-hidden="true" />}
      {children}
    </Tag>
  )
}

/** A segmented control: one track, one thumb, fixed weights. */
export function Segmented({ options, value, onChange, label, className }) {
  return (
    <div role="tablist" aria-label={label} className={cx('k-seg', className)}>
      {options.map(o => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value}
          className={cx('k-seg-opt', o.value === value && 'k-seg-on')}
          onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** A real switch: role=switch, knob on the end side when on (RTL-correct). */
export function Switch({ checked, onChange, label, className }) {
  return (
    <button type="button" role="switch" aria-checked={!!checked} aria-label={label}
      className={cx('k-switch', checked && 'k-switch-on', className)}
      onClick={() => onChange(!checked)}>
      <span className="k-switch-knob" />
    </button>
  )
}

// ── Lists ─────────────────────────────────────────────────────
/** A grouped list: rows on one surface, hairlines between them. */
export function ListGroup({ header, footer, children, className }) {
  return (
    <section className={cx('k-group', className)}>
      {header && <h3 className="k-group-h">{header}</h3>}
      <div className="k-group-body">{children}</div>
      {footer && <p className="k-group-f">{footer}</p>}
    </section>
  )
}

/**
 * One row. leading: an icon component or a node (thumbnail); trailing:
 * a value node; chevron for rows that open something. 52pt minimum,
 * 56 with a subtitle, 64 with a thumbnail.
 */
export function ListRow({ leading: Lead, title, subtitle, trailing, chevron, onClick, tone, className, children }) {
  const Tag = onClick ? 'button' : 'div'
  const lead = typeof Lead === 'function' || (Lead && Lead.$$typeof && Lead.render)
    ? <span className="k-row-icon"><Lead size={22} weight="regular" aria-hidden="true" /></span>
    : Lead
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick}
      className={cx('k-row', onClick && 'k-row-tap', tone && `k-row-${tone}`, className)}>
      {lead}
      <span className="k-row-main">
        <span className="k-row-title">{title}</span>
        {subtitle && <span className="k-row-sub">{subtitle}</span>}
        {children}
      </span>
      {trailing != null && <span className="k-row-trail">{trailing}</span>}
      {chevron && <CaretLeft size={16} weight="bold" className="k-row-chev" aria-hidden="true" />}
    </Tag>
  )
}

// ── Headers ───────────────────────────────────────────────────
/** A tab's large title (28/700) with trailing actions. */
export function LargeTitle({ title, eyebrow, actions, className }) {
  return (
    <header className={cx('k-large', className)}>
      <div className="k-large-text">
        {eyebrow && <span className="k-eyebrow">{eyebrow}</span>}
        <h1 className="k-large-title">{title}</h1>
      </div>
      {actions && <div className="k-large-actions">{actions}</div>}
    </header>
  )
}

/** A pushed page's bar: back on the right edge (RTL), title, actions. */
export function NavBar({ title, onBack, backLabel = 'رجوع', actions }) {
  return (
    <div className="k-navbar">
      <button type="button" className="k-navbar-back" onClick={onBack} aria-label={backLabel}>
        <CaretRight size={22} weight="bold" aria-hidden="true" />
        <span>{backLabel}</span>
      </button>
      <span className="k-navbar-title">{title}</span>
      <div className="k-navbar-actions">{actions}</div>
    </div>
  )
}

/** An editorial chapter: hairline, eyebrow, title. */
export function Chapter({ eyebrow, title, action, children, className, quiet }) {
  return (
    <section className={cx('k-chapter', quiet && 'k-chapter-quiet', className)}>
      {(eyebrow || title || action) && (
        <div className="k-chapter-h">
          <div>
            {eyebrow && <span className="k-eyebrow">{eyebrow}</span>}
            {title && <h2 className="k-chapter-title">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

// ── Indicators ────────────────────────────────────────────────
/** A 4px progress track. tone: accent · streak · rest · raise · ink. */
export function Gauge({ value = 0, max = 1, tone = 'accent', label, className }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  return (
    <div className={cx('k-gauge', className)} role="progressbar" aria-label={label}
      aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <i className={`k-gauge-fill k-tone-${tone}`} style={{ transform: `scaleX(${pct})` }} />
    </div>
  )
}

/** An inline notice. tone: neutral · streak · rest · danger · accent. */
export function Banner({ tone = 'neutral', icon: Icon, title, children, action, className }) {
  return (
    <div className={cx('k-banner', `k-banner-${tone}`, className)} role={tone === 'danger' ? 'alert' : 'status'}>
      {Icon && <Icon size={20} weight="bold" className="k-banner-icon" aria-hidden="true" />}
      <div className="k-banner-text">
        {title && <strong>{title}</strong>}
        {children && <span>{children}</span>}
      </div>
      {action}
    </div>
  )
}

/** A lit stage for 3D art: neutral light, edge to edge, text over the dark third. */
export function Stage({ art, alt = '', artStyle, className, children, height }) {
  return (
    <section className={cx('k-stage', className)} style={height ? { minHeight: height } : undefined}>
      {art && <img className="k-stage-art" src={art} alt={alt} style={artStyle} />}
      <div className="k-stage-body">{children}</div>
    </section>
  )
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="k-empty">
      {Icon && <Icon size={40} weight="regular" className="k-empty-icon" aria-hidden="true" />}
      <strong className="k-empty-title">{title}</strong>
      {children && <p className="k-empty-body">{children}</p>}
      {action}
    </div>
  )
}

// ── Sheets ────────────────────────────────────────────────────
/**
 * The one bottom sheet. Portal, scrim, grabber, title, close; Escape
 * closes; the page behind is inert and does not scroll; focus returns
 * to the opener. No overshoot on the way in, a real exit on the way out.
 */
export function Sheet({ open, onClose, title, children, footer, tall, labelledBy }) {
  const [mounted, setMounted] = useState(open)
  const [leaving, setLeaving] = useState(false)
  const [opener] = useState(() => (typeof document !== 'undefined' ? document.activeElement : null))
  const close = useRef(onClose)
  close.current = onClose
  const titleId = useId()

  useEffect(() => {
    if (open) { setMounted(true); setLeaving(false) }
    else if (mounted) {
      setLeaving(true)
      const t = setTimeout(() => { setMounted(false); setLeaving(false) }, 220)
      return () => clearTimeout(t)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mounted) return
    const root = document.getElementById('root')
    if (root) root.inert = true
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') close.current?.() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      if (root) root.inert = false
      opener?.focus?.()
    }
  }, [mounted, opener])

  if (!mounted) return null
  return createPortal(
    <div className={cx('k-scrim', leaving && 'k-leaving')} onClick={() => close.current?.()} role="presentation">
      <div className={cx('k-sheet', tall && 'k-sheet-tall', leaving && 'k-leaving')}
        role="dialog" aria-modal="true" aria-labelledby={labelledBy || (title ? titleId : undefined)}
        onClick={e => e.stopPropagation()}>
        <span className="k-sheet-grab" aria-hidden="true" />
        {title && (
          <div className="k-sheet-h">
            <h2 id={titleId}>{title}</h2>
            <IconButton icon={X} label="إغلاق" onClick={() => close.current?.()} />
          </div>
        )}
        <div className="k-sheet-body">{children}</div>
        {footer && <div className="k-sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/** A confirm: a question, what it costs, and two answers. */
export function ConfirmSheet({ open, onClose, title, message, confirmLabel, cancelLabel = 'رجوع', destructive, onConfirm }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}
      footer={(
        <div className="k-confirm-actions">
          <Button variant={destructive ? 'destructive-fill' : 'primary'} size="lg" full onClick={onConfirm}>{confirmLabel}</Button>
          <Button variant="secondary" size="lg" full onClick={onClose} autoFocus>{cancelLabel}</Button>
        </div>
      )}>
      {message && <p className="k-confirm-msg">{message}</p>}
    </Sheet>
  )
}
