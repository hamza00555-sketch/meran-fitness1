// ── Settings › shared parts ───────────────────────────────────
//
// The pieces every settings sub-page and the profile are built from, so
// a selection, a text field and a notice each look one way (critique
// F22, F51): a selection is a check-mark list, a field is one well, a
// notice is the kit Banner — never a browser alert.

import { Fragment, useId } from 'react'
import { Banner, IconButton, NavBar, Num } from '../../components/kit/index.jsx'
import { Check, X } from '../../components/kit/icons.js'
import '../../styles/screens/settings.css'

const cx = (...a) => a.filter(Boolean).join(' ')

// Digit and Latin runs inside Arabic copy: «3 تمارين ← تعافي», «4,200 XP»,
// «أخف 40%». Each run becomes an LTR isolate so it never reorders the
// Arabic around it, and takes the numeric face.
const RUN = /([+−]?[A-Za-z0-9](?:[A-Za-z0-9.,:%+×/–\- ]*[A-Za-z0-9%])?)/g

/** Arabic copy with every number or Latin run wrapped in <Num>. */
export function Ar({ children }) {
  if (typeof children !== 'string') return children ?? null
  const parts = children.split(RUN)
  return parts.map((p, i) => (i % 2 ? <Num key={i}>{p}</Num> : <Fragment key={i}>{p}</Fragment>))
}

/** A pushed sub-page inside Settings: its own back bar, then the body. */
export function SubPage({ title, onBack, backLabel = 'الإعدادات', actions, children }) {
  return (
    <>
      <NavBar title={title} onBack={onBack} backLabel={backLabel} actions={actions} />
      <div className="st-body st-push">{children}</div>
    </>
  )
}

/** «انحفظ» — shown briefly after a setting is written. */
export function Saved({ show }) {
  return (
    <span className={cx('st-saved', show && 'on')} role="status" aria-live="polite">
      {show && <><Check size={16} weight="bold" aria-hidden="true" /> انحفظ</>}
    </span>
  )
}

/** A one-of-many list: rows on one surface, a check on the chosen one. */
export function CheckList({ header, footer, label, children, className }) {
  return (
    <section className={cx('k-group', className)}>
      {header && <h3 className="k-group-h">{header}</h3>}
      <div className="k-group-body" role="radiogroup" aria-label={label || (typeof header === 'string' ? header : undefined)}>
        {children}
      </div>
      {footer && <div className="k-group-f">{footer}</div>}
    </section>
  )
}

export function CheckRow({ title, subtitle, trailing, checked, onClick, leading: Lead, disabled }) {
  const lead = typeof Lead === 'function' || (Lead && Lead.$$typeof && Lead.render)
    ? <span className="k-row-icon"><Lead size={22} weight="regular" aria-hidden="true" /></span>
    : Lead
  return (
    <button type="button" role="radio" aria-checked={!!checked} disabled={disabled}
      className={cx('k-row k-row-tap st-check', checked && 'on')} onClick={onClick}>
      {lead}
      <span className="k-row-main">
        <span className="k-row-title">{title}</span>
        {subtitle && <span className="k-row-sub">{subtitle}</span>}
      </span>
      {trailing != null && <span className="k-row-trail">{trailing}</span>}
      <span className="st-check-mark" aria-hidden="true">
        {checked && <Check size={22} weight="bold" />}
      </span>
    </button>
  )
}

/**
 * The one text field. 48pt, 16px (no iOS focus zoom), one well colour,
 * focus drawn by CSS. `numeric` gives an LTR decimal field; `unit` sits
 * at the end of the well.
 */
export function TextField({ label, unit, numeric, multiline, hint, invalid, className, inputRef, ...rest }) {
  const id = useId()
  const Tag = multiline ? 'textarea' : 'input'
  return (
    <div className={cx('st-field', invalid && 'invalid', className)}>
      {label && <label className="st-field-label" htmlFor={id}>{label}</label>}
      <span className="st-field-box">
        <Tag id={id} ref={inputRef}
          {...(numeric ? { type: 'text', inputMode: numeric === 'int' ? 'numeric' : 'decimal', dir: 'ltr' } : {})}
          aria-invalid={invalid || undefined}
          {...rest} />
        {unit && <span className="st-field-unit">{unit}</span>}
      </span>
      {hint && <span className="st-field-hint">{hint}</span>}
    </div>
  )
}

/** An in-page notice in place of window.alert(). */
export function Notice({ notice, onClose }) {
  if (!notice) return null
  return (
    <Banner tone={notice.tone || 'neutral'} icon={notice.icon} title={notice.title}
      className="st-notice"
      action={onClose && <IconButton icon={X} label="إخفاء" size={36} iconSize={18} onClick={onClose} />}>
      {notice.text}
    </Banner>
  )
}

/** A switch that can be disabled (the kit one cannot). */
export function SwitchControl({ checked, onChange, label, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={!!checked} aria-label={label} disabled={disabled}
      className={cx('k-switch', checked && 'k-switch-on', 'st-switch')}
      onClick={() => onChange(!checked)}>
      <span className="k-switch-knob" />
    </button>
  )
}

// ── Copy helpers ──────────────────────────────────────────────
// The engines keep labels with Arabic-Indic digits (recovery.js,
// progression.js). The screens say them again in Western digits.

const DAYS_COPY = { 3: 'تمرين، وبعده يوم تعافي', 4: 'تمرينين، وبعدها يوم تعافي', 5: '3 تمارين، تعافي، تمرينين، تعافي', 6: '3 تمارين، وبعدها يوم تعافي' }
export const freqTitle = (id) => `${id} أيام في الأسبوع`
export const freqDesc = (f) => DAYS_COPY[f.id] || String(f.desc || '')

export const workoutsAr = (n) => (n === 1 ? 'تمرين واحد' : n === 2 ? 'تمرينين' : `${n} تمارين`)
/** «تمرينين ← تعافي ← 3 تمارين ← تعافي» */
export const cycleAr = (pattern = []) => pattern.map(n => `${workoutsAr(n)} ← تعافي`).join(' ← ')
