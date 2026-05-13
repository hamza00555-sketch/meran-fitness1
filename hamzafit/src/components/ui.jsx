// ── Shared UI Primitives ──────────────────────────────────────

// Badge
export function Badge({ children, color = '#FF6B35', style = {} }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      background: color + '20', color,
      border: `1px solid ${color}38`,
      borderRadius: 20, padding: '2px 9px',
      fontSize: 11, fontFamily: 'var(--font-mono)',
      fontWeight: 600, whiteSpace: 'nowrap',
      ...style,
    }}>{children}</span>
  )
}

// Card
export function Card({ children, style = {}, glow, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 18,
        boxShadow: glow ? `0 0 28px ${glow}14` : 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >{children}</div>
  )
}

// Button variants
const BTN_VARIANTS = {
  primary: {
    background: 'linear-gradient(135deg,#FF6B35,#FF8C5A)',
    color: '#fff',
    border: 'none',
    boxShadow: '0 4px 20px #FF6B3540',
  },
  secondary: {
    background: 'var(--bg3)',
    color: 'var(--text)',
    border: '1px solid var(--border2)',
    boxShadow: 'none',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text3)',
    border: '1px solid var(--border)',
    boxShadow: 'none',
  },
  danger: {
    background: '#EF444418',
    color: '#EF4444',
    border: '1px solid #EF444430',
    boxShadow: 'none',
  },
  success: {
    background: '#22C55E18',
    color: '#22C55E',
    border: '1px solid #22C55E30',
    boxShadow: 'none',
  },
  gold: {
    background: 'linear-gradient(135deg,#EAB308,#F59E0B)',
    color: '#0a0a0a',
    border: 'none',
    boxShadow: '0 4px 20px #EAB30840',
  },
}

export function Btn({
  children, onClick, variant = 'primary',
  disabled = false, style = {}, full = false,
}) {
  const v = BTN_VARIANTS[variant] || BTN_VARIANTS.primary
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        ...v,
        borderRadius: 'var(--radius-sm)',
        padding: '11px 20px',
        fontFamily: 'var(--font-ar)',
        fontWeight: 700,
        fontSize: 14,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'opacity 0.18s, transform 0.12s',
        outline: 'none',
        width: full ? '100%' : undefined,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        ...style,
      }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)' }}
      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
    >{children}</button>
  )
}

// Text Input
export function Input({ value, onChange, placeholder, type = 'text', disabled = false, style = {} }) {
  return (
    <input
      type={type}
      inputMode={type === 'number' ? 'decimal' : undefined}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '9px 12px',
        color: 'var(--text)',
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        outline: 'none',
        width: '100%',
        transition: 'border-color 0.2s',
        ...style,
      }}
      onFocus={e => e.target.style.borderColor = 'var(--orange)'}
      onBlur={e => e.target.style.borderColor = 'var(--border)'}
    />
  )
}

// Select
export function Select({ value, onChange, children, style = {} }) {
  return (
    <select
      value={value}
      onChange={onChange}
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 12px',
        color: 'var(--text)',
        fontFamily: 'var(--font-ar)',
        fontSize: 14,
        outline: 'none',
        width: '100%',
        cursor: 'pointer',
        ...style,
      }}
    >{children}</select>
  )
}

// Modal Overlay
export function Overlay({ children, onClose, align = 'center' }) {
  return (
    <div
      className="overlay-enter"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: '#000000cc',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: align === 'bottom' ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: align === 'bottom' ? '0 12px 12px' : 20,
      }}
    >
      <div className="modal-enter" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 540 }}>
        {children}
      </div>
    </div>
  )
}

// Close button
export function CloseBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none',
        color: 'var(--text3)', fontSize: 22,
        cursor: 'pointer', lineHeight: 1, padding: 4,
        transition: 'color 0.15s',
      }}
      onMouseOver={e => e.currentTarget.style.color = 'var(--text)'}
      onMouseOut={e => e.currentTarget.style.color = 'var(--text3)'}
    >×</button>
  )
}

// Stat Box
export function StatBox({ label, value, color = '#FF6B35', sub }) {
  return (
    <Card style={{ flex: 1, textAlign: 'center', padding: '16px 10px' }} glow={color}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 26,
        fontWeight: 700, color, lineHeight: 1,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{sub}</div>}
      <div style={{ fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>{label}</div>
    </Card>
  )
}

// Section Header
export function SectionHeader({ children, sub }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 700, color: 'var(--text2)' }}>{children}</div>
      {sub && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text4)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// Pill tab selector
export function PillTabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {tabs.map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          style={{
            background: active === t ? 'var(--orange-lo)' : 'var(--bg2)',
            border: `1px solid ${active === t ? 'var(--orange)' : 'var(--border)'}`,
            borderRadius: 20,
            padding: '6px 16px',
            color: active === t ? 'var(--orange)' : 'var(--text3)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            cursor: 'pointer',
            transition: 'all 0.18s',
          }}
        >{t}</button>
      ))}
    </div>
  )
}
