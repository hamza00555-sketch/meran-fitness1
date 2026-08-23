import Art from '../assets/Art.jsx'
import { toWesternDigits } from '../day.js'
import { dayDiff } from '../recovery.js'

/**
 * Shown once, on the first open after a deload closes.
 *
 * The whole design of the deload is that nothing needs restoring — the
 * app simply stopped writing lighter weights over the baseline. That is
 * reassuring but invisible, so this screen makes it visible: here is
 * the weight you are going back to, and it is the same one you left.
 *
 * `heaviest` is the single lift that best answers "back to what" — a
 * number the user recognises beats a sentence promising one.
 */
export default function DeloadEndScreen({ entry, heaviest, onDismiss }) {
  const days = entry ? dayDiff(entry.from, entry.until || entry.plannedUntil) + 1 : 0

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.92)',
      backdropFilter: 'blur(12px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      {/* The mode is already off by the time this renders, so the glow
          is green again — which is the point being made. */}
      <div style={{
        position: 'absolute', width: 340, height: 340, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(var(--cyan-rgb),0.14) 0%, rgba(var(--purple-rgb),0.06) 50%, transparent 70%)',
        animation: 'glowPulse 2s ease-in-out infinite',
      }} />

      <div style={{
        position: 'relative', textAlign: 'center', maxWidth: 340,
        animation: 'scaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards',
      }}>
        <div style={{ fontSize: 64, marginBottom: 16, lineHeight: 1 }} className="icon-glow">
          <Art id="deload_end" size={64} fallback="💪" />
        </div>

        <div className="shimmer-text" style={{
          fontFamily: 'var(--font-mono)', fontSize: 13,
          fontWeight: 800, letterSpacing: 6, marginBottom: 10,
        }}>
          DELOAD COMPLETE
        </div>

        <div style={{
          fontFamily: 'var(--font-ar)', fontSize: 26, fontWeight: 900,
          color: 'var(--cyan)', marginBottom: 8, lineHeight: 1.4,
        }}>
          خلص الديلود
        </div>

        <div style={{
          fontFamily: 'var(--font-ar)', fontSize: 15, color: 'var(--text2)',
          lineHeight: 1.9, marginBottom: 22,
        }}>
          {days > 0 && `${toWesternDigits(days)} ${days === 1 ? 'يوم' : 'أيام'} بأوزان أخف بـ${toWesternDigits(entry.pct)}٪. `}
          أوزانك رجعت كما كانت بالضبط — ما ضاع منها شي.
        </div>

        {heaviest && (
          <div style={{
            background: 'var(--cyan-lo)', border: '1px solid var(--cyan-md)',
            borderRadius: 16, padding: '14px 18px', marginBottom: 24,
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: 'var(--text3)', letterSpacing: 2, marginBottom: 6,
            }}>
              ترجع إلى
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 34, fontWeight: 900,
              color: 'var(--cyan)', lineHeight: 1,
              animation: 'levelBurst 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards',
            }}>
              {toWesternDigits(heaviest.weight)}<span style={{ fontSize: 16 }}> كجم</span>
            </div>
            <div style={{
              fontFamily: 'var(--font-ar)', fontSize: 13,
              color: 'var(--text2)', marginTop: 6,
            }}>
              {heaviest.name}
            </div>
          </div>
        )}

        <button onClick={onDismiss} className="btn-cyan" style={{ maxWidth: 240, margin: '0 auto' }}>
          يلا نكمل 💪
        </button>
      </div>
    </div>
  )
}
