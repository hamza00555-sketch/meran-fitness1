import { useLayoutEffect, useState } from 'react'
import { streakView, unitAr } from '../../streak.js'
import { restDayCount, restDaysAr } from '../../restDays.js'
import { Num } from '../kit/index.jsx'
import RollNumber from '../RollNumber.jsx'
import LiveFlame from './LiveFlame.jsx'
import { flameIgnition, readLit, writeLit } from './flameLit.js'
import { reducedMotion } from '../../motion.js'

// ── The streak on Home: the number, nothing else ──────────────
// حمزة: «انا اللي همني فقط رقم الستريك لا اكثر». The scoreboard put a
// status line, a 03:00 countdown, the cost of a miss, seven days,
// tickets and a milestone around it, and that was too much. So Home
// shows the flame and the number.
//
// The flame says whether he holds an optional rest day (حمزة: «الشعلة
// … لما تكون بس ستروك معناها ما عندي ولا يوم راحة اختياري، لكن لما
// يكون عندي يوم راحة اختياري يصير فيها فل، ممكن حتى شوية جلو بسيط»):
// an outline at none, filled with a soft glow at one or more. (It used
// to say whether today counted; that is now said in words at the top of
// «ليش N؟».) How many, and since when, is one tap away, in «ليش 39؟».
//
// The flame is alive: it moves gently all the time («يتحرك بهدوء
// دايماً»), and the first time Home sees today counted it hops and lets
// off three embers, and after a workout the number rolls up to its new
// value (useFlameIgnition, once a day). The rolling digits sit over the
// number, which stays the button's text throughout.

/**
 * Once a day, when today counts and nothing covers Home.
 *   { on: true, from }   lighting now (from: the number to roll up from, or null)
 *   { pending: true, from }  today counts but Home is still covered (the
 *                        summary, the level-up screen): Home keeps showing
 *                        the flame unlit and the number it had, so the
 *                        moment is still to come when it is uncovered
 *   null                 nothing to do (lit already today, not counted,
 *                        reduced motion: simply filled)
 * Decided before paint (layout effect), so no frame shows the new number
 * before it rolls to it.
 */
export function useFlameIgnition(v, hold = false) {
  const [run, setRun] = useState(null)
  const plan = flameIgnition({ counted: v.counted, kind: v.kind, number: v.number, today: v.today, lit: readLit() })
  useLayoutEffect(() => {
    if (!plan || hold) return
    writeLit(v.today)
    if (reducedMotion()) return   // simply filled: nothing to watch
    setRun({ day: v.today, ...plan })
  }, [v.counted, v.today, hold]) // eslint-disable-line react-hooks/exhaustive-deps
  if (run && run.day === v.today) return { on: true, from: run.from }
  if (plan && !reducedMotion()) return { pending: true, from: plan.from }
  return null
}

export default function StreakNumber({ recovery, config, active, deload, today, onOpen, ignite = null }) {
  const v = streakView({ recovery, config, active, deload, today })
  const rest = restDayCount(recovery)
  const restSays = rest > 0 ? `وعندك ${restDaysAr(rest)}` : 'وما عندك ولا يوم راحة اختياري'
  const lighting = !!ignite?.on
  const waiting = !!ignite?.pending
  const roll = lighting && ignite.from != null && ignite.from !== v.number
  const [rolled, setRolled] = useState(false)
  const rolling = roll && !rolled
  // still covered: the flame unlit and the number as it was, until it lights
  const shown = waiting && ignite.from != null ? ignite.from : v.number
  return (
    <button type="button" className={`h-streak${v.counted ? ' counted' : ''}${rest > 0 ? ' h-streak-rest' : ''}`} onClick={onOpen}
      aria-label={`الستريك ${v.number} ${unitAr(v.number, 'day')}، ${restSays} — اضغط تشوف التفاصيل`}
      data-testid="streak-number" data-rest-days={rest}>
      <span className="h-streak-flame"><LiveFlame size={30} filled={rest > 0} glow ignite={lighting} sweep={false} sway /></span>
      <span className="h-streak-n">
        <b className={`${shown === 0 ? 'zero' : ''}${rolling ? ' h-streak-ghost' : ''}`}><Num>{shown}</Num></b>
        {rolling && (
          <span className="h-streak-roll" aria-hidden="true">
            <RollNumber from={ignite.from} to={v.number} delay={430} onDone={() => setRolled(true)} />
          </span>
        )}
      </span>
      <span className="h-streak-unit">{unitAr(v.number, 'day')}</span>
    </button>
  )
}
