// ── Shared UI Primitives ──────────────────────────────────────

// Card
export function Card({ children, style = {}, topColor, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        borderTop: topColor ? `2px solid ${topColor}` : '1px solid var(--border)',
        padding: 20,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >{children}</div>
  )
}

// Button variants
const BTN_VARIANTS = {
  primary: {
    background: 'linear-gradient(135deg, var(--cyan), #7D3C98)',
    color: '#F0F4FF',
    border: 'none',
    boxShadow: '0 4px 20px rgba(155,89,182,0.35)',
  },
  secondary: {
    background: 'var(--bg2)',
    color: 'var(--text)',
    border: '1px solid var(--border2)',
    boxShadow: 'none',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text2)',
    border: '1px solid var(--border)',
    boxShadow: 'none',
  },
  danger: {
    background: 'var(--red-lo)',
    color: 'var(--red)',
    border: '1px solid var(--red-md)',
    boxShadow: 'none',
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
        padding: '14px 20px',
        fontFamily: 'var(--font-ar)',
        fontWeight: 700,
        fontSize: 16,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'opacity 0.15s, transform 0.12s',
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

// Badge
export function Badge({ children, color = '#00D4C8' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      background: color + '20', color,
      border: `1px solid ${color}38`,
      borderRadius: 20, padding: '2px 9px',
      fontSize: 11, fontFamily: 'var(--font-mono)',
      fontWeight: 600, whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

// Section Title with cyan left bar (RTL = right bar)
export function SectionTitle({ children, action }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 3, height: 18, background: 'var(--cyan)',
          borderRadius: 2, flexShrink: 0,
        }} />
        <span style={{
          fontFamily: 'var(--font-ar)', fontSize: 17, fontWeight: 700,
          color: 'var(--text)',
        }}>{children}</span>
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// Empty State
export function EmptyState({ icon, title, desc }) {
  return (
    <div style={{
      textAlign: 'center', padding: '50px 20px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    }}>
      <div className="icon-glow" style={{ fontSize: 52 }}>{icon}</div>
      <div style={{ fontFamily: 'var(--font-ar)', fontSize: 17, fontWeight: 700, color: 'var(--text2)' }}>
        {title}
      </div>
      {desc && (
        <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)', maxWidth: 240 }}>
          {desc}
        </div>
      )}
    </div>
  )
}

// Progress Bar
export function ProgressBar({ value = 0, max = 100, color = 'var(--cyan)', height = 6 }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{
      background: 'var(--bg3)', borderRadius: height, height, overflow: 'hidden',
    }}>
      <div style={{
        height: '100%', width: `${pct}%`,
        background: color, borderRadius: height,
        transition: 'width 0.6s ease',
      }} />
    </div>
  )
}

// Rank Badge Chip
export function RankBadge({ rank }) {
  if (!rank) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: rank.bg || rank.color + '20',
      color: rank.color,
      border: `1px solid ${rank.color}50`,
      borderRadius: 20, padding: '3px 10px',
      fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
    }}>
      {rank.img && <img src={rank.img} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />}
      {rank.tier} · {rank.label}
    </span>
  )
}

// Modal Overlay
export function Overlay({ children, onClose, align = 'center' }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.85)',
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

// Close Button
export function CloseBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none',
        color: 'var(--text3)', fontSize: 22,
        cursor: 'pointer', lineHeight: 1, padding: 4,
        transition: 'color 0.15s', flexShrink: 0,
      }}
      onMouseOver={e => e.currentTarget.style.color = 'var(--text)'}
      onMouseOut={e => e.currentTarget.style.color = 'var(--text3)'}
    >×</button>
  )
}
