import { getRank } from '../utils.js'

export default function LevelUpScreen({ level, onDismiss }) {
  const rank = getRank(level)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.92)',
      backdropFilter: 'blur(12px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      {/* Glow rings */}
      <div style={{
        position: 'absolute', width: 340, height: 340,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(94,195,42,0.14) 0%, rgba(59,157,232,0.06) 50%, transparent 70%)',
        animation: 'glowPulse 2s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: 200, height: 200,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(94,195,42,0.10) 0%, transparent 70%)',
        animation: 'glowPulse 1.8s ease-in-out infinite',
        animationDelay: '0.3s',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative', textAlign: 'center',
        animation: 'scaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards',
      }}>
        {/* Crown */}
        <div style={{ fontSize: 64, marginBottom: 16, lineHeight: 1 }}
          className="icon-glow">
          👑
        </div>

        {/* LEVEL UP text */}
        <div className="shimmer-text" style={{
          fontFamily: 'var(--font-mono)', fontSize: 13,
          fontWeight: 800, letterSpacing: 6, marginBottom: 8,
        }}>
          LEVEL UP!
        </div>

        {/* Level number */}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 72, fontWeight: 900,
          color: 'var(--cyan)', lineHeight: 1,
          textShadow: '0 0 40px rgba(94,195,42,0.7), 0 0 80px rgba(94,195,42,0.3)',
          marginBottom: 4,
          animation: 'levelBurst 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards',
        }}>
          {level}
        </div>

        {/* Level label */}
        <div style={{
          fontFamily: 'var(--font-ar)', fontSize: 18,
          color: 'var(--text2)', marginBottom: 20,
        }}>
          مستوى {level}
        </div>

        {/* Rank badge */}
        {rank && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: rank.bg || rank.color + '20',
            border: `1px solid ${rank.color}50`,
            borderRadius: 24, padding: '8px 20px',
            marginBottom: 32,
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontWeight: 800,
              fontSize: 14, color: rank.color,
            }}>{rank.tier}</span>
            <span style={{
              fontFamily: 'var(--font-ar)', fontWeight: 700,
              fontSize: 16, color: rank.color,
            }}>{rank.label}</span>
          </div>
        )}

        {/* Dismiss button */}
        <div>
          <button
            onClick={onDismiss}
            className="btn-cyan"
            style={{ maxWidth: 240, margin: '0 auto' }}
          >
            استمر 💪
          </button>
        </div>
      </div>
    </div>
  )
}
