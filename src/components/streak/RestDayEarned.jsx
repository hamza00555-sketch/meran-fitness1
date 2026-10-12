import { useEffect } from 'react'
import { Sheet, Button } from '../kit/index.jsx'
import { withNums } from '../home/HomeBits.jsx'
import RollNumber from '../RollNumber.jsx'
import LiveFlame from './LiveFlame.jsx'
import { Moon } from './StreakIcons.jsx'
import { earnedCopy } from '../../restDays.js'
import { fmtDayAr } from '../../streak.js'
import { play } from '../../sound.js'
import { haptic } from '../../haptics.js'
import '../../styles/rest-earned.css'

// ── «كسبت يوم راحة» ───────────────────────────────────────────
// حمزة: «حتى لما أكسب ستريك المفروض يكون فيه زي إعلان أنا كسبت يوم
// راحة». A short moment, once per rest day earned (App remembers which
// under 'meran_rest_announced'): the flame fills from the bottom with
// its embers — the flame on Home is filled while he holds one — and the
// number of rest days he holds rolls up, in rest blue. One library sound
// (the medal's), one light haptic. It comes after the session summary
// and the level-up screen, never over them. Reduced motion: all in
// place, still.
//
// Props: days — [{ earnedOn, streak }] just earned; count — how many he
// holds now; onClose.

export default function RestDayEarned({ days, count, onClose }) {
  const c = earnedCopy(days, count)
  const from = Math.max(0, count - days.length)

  useEffect(() => {
    play('medal')
    haptic('medal')
  }, [])

  return (
    <Sheet open onClose={onClose} labelledBy="re-title"
      footer={<Button size="lg" full onClick={onClose} data-testid="rest-earned-ok">تمام</Button>}>
      <div className="re" data-testid="rest-earned" role="status" aria-label={c.aria}>
        <span className="re-flame"><LiveFlame size={64} filled glow ignite sway /></span>
        <p className="re-eyebrow">يوم راحة جديد</p>
        <h2 id="re-title" className="re-title">{c.title}</h2>
        {c.line && <p className="re-line">{withNums(c.line)}</p>}
        <div className="re-count" aria-hidden="true">
          <span className="re-moon"><Moon size={18} /></span>
          <b className="re-n"><RollNumber from={from} to={count} delay={650} /></b>
        </div>
        <p className="re-total">{withNums(c.total)}</p>
        {days.length === 1 && <p className="re-hint">{withNums(`${fmtDayAr(days[0].earnedOn)} · ${c.hint}`)}</p>}
        {days.length > 1 && <p className="re-hint">{c.hint}</p>}
      </div>
    </Sheet>
  )
}
