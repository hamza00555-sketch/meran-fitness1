import Art from '../assets/Art.jsx'
import { DropletIcon } from './Icons.jsx'
import { toWesternDigits } from '../day.js'

/**
 * The counter that sits at the top of the home screen for the length of
 * the period.
 *
 * The palette already says a deload is running; this says how far in.
 * That is the one fact the colour cannot carry, and the one people
 * actually want — not "you are deloading" but "two more days".
 */
export function DeloadBanner({ state, onOpen }) {
  if (!state?.active) return null
  const { day, totalDays, daysLeft, pct } = state

  return (
    <div
      onClick={onOpen}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--cyan-lo)',
        border: '1px solid var(--cyan-md)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 14px',
        marginBottom: 'var(--hp-card-mb)',
        cursor: onOpen ? 'pointer' : 'default',
      }}
    >
      <Art id="deload_badge" size={22} fallback={<DropletIcon size={20} color="var(--cyan)" />} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: 800,
          color: 'var(--cyan)', lineHeight: 1.4,
        }}>
          ديلود · اليوم {toWesternDigits(day)} من {toWesternDigits(totalDays)}
        </div>
        <div style={{ fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
          {daysLeft > 0
            ? `باقي ${toWesternDigits(daysLeft)} ${daysLeft === 1 ? 'يوم' : 'أيام'} · أوزانك أخف بـ${toWesternDigits(pct)}٪`
            : `آخر يوم · بكرة ترجع أوزانك`}
        </div>
      </div>

      {/* The same run of marks as the settings card, small enough to
          read as a progress strip rather than a chart. */}
      <div style={{ display: 'flex', gap: 3 }}>
        {Array.from({ length: totalDays }, (_, i) => (
          <div key={i} style={{
            width: 4, height: 16, borderRadius: 2,
            background: i < day ? 'var(--cyan)' : 'var(--bg3)',
            opacity: i < day ? 0.5 + 0.5 * ((i + 1) / day) : 1,
          }} />
        ))}
      </div>
    </div>
  )
}

/**
 * The app raising a deload itself.
 *
 * Only ever shown when suggestDeload says both of its conditions are
 * met — stalled lifts and enough time — so this component does no
 * judging of its own. Turning it down is a real answer and buys a
 * fortnight of quiet, which is why the dismiss is as prominent as the
 * accept.
 */
export function DeloadSuggestion({ reason, onAccept, onDismiss }) {
  if (!reason) return null

  return (
    <div style={{
      background: 'var(--purple-lo)',
      border: '1px solid var(--purple-md)',
      borderRadius: 'var(--radius)',
      padding: 14,
      marginBottom: 'var(--hp-card-mb)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <DropletIcon size={18} color="var(--purple)" />
        <div style={{ fontFamily: 'var(--font-ar)', fontSize: 16, fontWeight: 800, color: 'var(--purple)' }}>
          يمكن وقت ديلود؟
        </div>
      </div>

      <div style={{
        fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text2)',
        lineHeight: 1.9, marginBottom: 12,
      }}>
        {toWesternDigits(reason.stalledCount)} تمارين واقفة على نفس الوزن ما تتقدم
        {reason.daysSinceLastDeload === null
          ? '، وما سبق لك تسوي ديلود'
          : `، وصار ${toWesternDigits(reason.daysSinceLastDeload)} يوم من آخر ديلود`}.
        {' '}أسبوع بأوزان أخف بـ{toWesternDigits(reason.suggestedPct)}٪ عادةً يفك الوقفة.
        القرار قرارك.
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onAccept?.({ days: reason.suggestedDays, pct: reason.suggestedPct })}
          style={{
            flex: 2, padding: '11px 10px', borderRadius: 12, border: 'none',
            background: 'var(--purple)', color: '#0A0A0A',
            fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: 800, cursor: 'pointer',
          }}
        >
          ابدأ ديلود {toWesternDigits(reason.suggestedDays)} أيام
        </button>
        <button
          onClick={onDismiss}
          style={{
            flex: 1, padding: '11px 10px', borderRadius: 12,
            background: 'transparent', border: '1px solid var(--border2)',
            color: 'var(--text3)', fontFamily: 'var(--font-ar)', fontSize: 14, cursor: 'pointer',
          }}
        >
          مو الحين
        </button>
      </div>
    </div>
  )
}
