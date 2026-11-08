import { useEffect, useMemo, useState } from 'react'
import { Num } from '../kit/index.jsx'
import { Trophy, ChartBar, Medal } from '../kit/icons.js'
import StreakNumber from '../streak/StreakNumber.jsx'
import { bestWeights, monthNumbers, levelNow, homeTopOf, HOME_TOP_EVERY_MS } from '../../homeTop.js'
import { arabicName } from '../../exerciseMedia.js'
import { EXERCISE_ALTERNATIVES } from '../../constants.js'
import { kgText } from '../../monthReport.js'
import { reducedMotion } from '../../motion.js'

// ── The top of Home: the streak, or what he chose instead ─────
// (src/homeTop.js). The weights and the month turn over by themselves,
// one item every few seconds, each sliding up into place; a tap opens
// where the number comes from. With nothing to show yet (no weights
// lifted), the streak keeps the place.

/** One item after another, every HOME_TOP_EVERY_MS while the page is in view. */
function useTurn(count) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (count < 2) return
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') setI(n => n + 1)
    }, HOME_TOP_EVERY_MS)
    return () => clearInterval(t)
  }, [count])
  return count ? i % count : 0
}

function Stat({ kind, icon: Icon, value, unit, unitFirst = false, label, onOpen, aria, turn, children }) {
  const still = reducedMotion()
  return (
    <button type="button" className={`h-stat h-stat-${kind}`} onClick={onOpen} aria-label={aria} data-testid="home-top" data-kind={kind}>
      <span key={turn} className={`h-stat-in${still ? '' : ' moving'}`}>
        <span className="h-stat-row">
          <Icon size={26} weight="fill" aria-hidden="true" className="h-stat-icon" />
          {unitFirst && <span className="h-stat-unit">{unit}</span>}
          <b className="h-stat-n">{value}</b>
          {!unitFirst && unit && <span className="h-stat-unit">{unit}</span>}
        </span>
        {children || <span className="h-stat-label">{label}</span>}
      </span>
    </button>
  )
}

export default function HomeTop({
  choice, sessions, plan, planIndex, mapping, subs, xp, today, goals,
  onOpenProgress, onOpenProfile, streak,
}) {
  const kind = homeTopOf(choice)
  const weights = useMemo(() => (kind === 'weights'
    ? bestWeights({ plan, planIndex, sessions, mapping, subs, alternatives: EXERCISE_ALTERNATIVES }) : []),
  [kind, plan, planIndex, sessions, mapping, subs])
  const month = useMemo(() => (kind === 'month' ? monthNumbers({ sessions, today, goals }) : []),
    [kind, sessions, today, goals])
  const items = kind === 'weights' ? weights : kind === 'month' ? month : []
  const at = useTurn(items.length)

  if (kind === 'weights' && weights.length) {
    const w = weights[at]
    const ar = arabicName(w.name, mapping)
    return (
      <Stat kind="weights" turn={`${at}:${w.name}`} icon={Trophy} value={<Num>{kgText(w.kg)}</Num>} unit="كجم"
        label={ar || <bdi dir="ltr">{w.name}</bdi>} onOpen={onOpenProgress}
        aria={`أعلى وزن في ${ar || w.name}: ${kgText(w.kg)} كجم — اضغط تشوف تقدّمك`} />
    )
  }
  if (kind === 'month' && month.length) {
    const m = month[at]
    return (
      <Stat kind="month" turn={`${at}:${m.id}`} icon={ChartBar}
        value={m.of ? <><Num>{m.value}</Num><span className="h-stat-of"> من <Num>{m.of}</Num></span></> : <Num>{m.value}</Num>}
        unit={m.unit} label={m.label} onOpen={onOpenProgress}
        aria={`${m.label}: ${m.value}${m.of ? ` من ${m.of}` : ''} ${m.unit} — اضغط تشوف تقدّمك`} />
    )
  }
  if (kind === 'level') {
    const l = levelNow(xp)
    return (
      <Stat kind="level" turn="level" icon={Medal} value={<Num>{l.level}</Num>} unit="المستوى" unitFirst onOpen={onOpenProfile}
        aria={`المستوى ${l.level}، باقي ${l.left} XP على اللي بعده — اضغط تشوف ملفك`}>
        <span className="h-stat-label h-stat-xp">
          <i className="h-stat-bar" aria-hidden="true"><i style={{ transform: `scaleX(${l.frac})` }} /></i>
          باقي <Num>{l.left}</Num> XP
        </span>
      </Stat>
    )
  }
  return <StreakNumber {...streak} />
}
