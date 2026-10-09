import Art from '../assets/Art.jsx'
import { Banner, Button, Num, Gauge } from './kit/index.jsx'
import { Drop } from './kit/icons.js'

// The deload's two notices, on the kit's Banner: a quiet surface with
// the droplet in the rest colour, no tinted box, no second green fill
// (Home already has its one: «ابدأ التمرين»).

const DropIcon = (p) => <Drop {...p} weight="fill" />

/**
 * The counter for the length of the period: not "you are deloading" —
 * the palette already says that — but how far in.
 */
export function DeloadBanner({ state, onOpen }) {
  if (!state?.active) return null
  const { day, totalDays, daysLeft, pct } = state

  return (
    <div className="hm-banner-wrap" onClick={onOpen} role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={onOpen ? (e => { if (e.key === 'Enter' || e.key === ' ') onOpen() }) : undefined}>
      <Banner
        tone="rest"
        className="hm-deload-banner"
        icon={(p) => <Art id="deload_badge" size={20} fallback={<DropIcon {...p} />} />}
        title={<>ديلود · اليوم <Num>{day}</Num> من <Num>{totalDays}</Num></>}
      >
        {daysLeft > 0
          ? <>باقي <Num>{daysLeft}</Num> {daysLeft === 1 ? 'يوم' : 'أيام'} · أوزانك أخف بـ<Num>{pct}%</Num></>
          : 'آخر يوم · بكرة ترجع أوزانك'}
        <Gauge value={day} max={totalDays} tone="rest" label="تقدم الديلود" className="hm-deload-gauge" />
      </Banner>
    </div>
  )
}

/**
 * The app raising a deload itself.
 *
 * Only ever shown when suggestDeload says both of its conditions are
 * met — stalled lifts and enough time — so this component does no
 * judging of its own. Turning it down is a real answer and buys a
 * fortnight of quiet, which is why the dismiss sits beside the accept
 * at the same weight.
 */
export function DeloadSuggestion({ reason, onAccept, onDismiss }) {
  if (!reason) return null

  return (
    <Banner
      tone="rest"
      className="hm-suggest"
      icon={DropIcon}
      title="يمكن وقت ديلود؟"
      action={(
        <div className="hm-suggest-actions">
          <Button variant="secondary" size="md"
            onClick={() => onAccept?.({ days: reason.suggestedDays, pct: reason.suggestedPct })}>
            ابدأ ديلود <Num>{reason.suggestedDays}</Num> أيام
          </Button>
          <Button variant="plain" size="md" className="hm-suggest-later" onClick={onDismiss}>مو الحين</Button>
        </div>
      )}
    >
      <Num>{reason.stalledCount}</Num> تمارين واقفة على نفس الوزن ما تتقدم
      {reason.daysSinceLastDeload === null
        ? '، وما سبق لك تسوي ديلود'
        : <>، وصار <Num>{reason.daysSinceLastDeload}</Num> يوم من آخر ديلود</>}.
      {' '}أسبوع بأوزان أخف بـ<Num>{reason.suggestedPct}%</Num> عادةً يفك الوقفة. القرار قرارك.
    </Banner>
  )
}
