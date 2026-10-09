import { streakView, unitAr } from '../../streak.js'
import { Flame } from './StreakIcons.jsx'
import { Num } from '../kit/index.jsx'

// ── The streak on Home: the number, nothing else ──────────────
// حمزة: «انا اللي همني فقط رقم الستريك لا اكثر». The scoreboard put a
// status line, a 03:00 countdown, the cost of a miss, seven days,
// tickets and a milestone around it, and that was too much. So Home
// shows the flame and the number. The flame is filled once today counts
// and an outline while it is still owed — a state you can read without
// a word. Everything else is one tap away, in «ليش 39؟».

export default function StreakNumber({ recovery, config, active, deload, today, onOpen }) {
  const v = streakView({ recovery, config, active, deload, today })
  return (
    <button type="button" className={`h-streak${v.counted ? ' counted' : ''}`} onClick={onOpen}
      aria-label={`الستريك ${v.number} ${unitAr(v.number, 'day')} — اضغط تشوف التفاصيل`}
      data-testid="streak-number">
      <span className="h-streak-flame"><Flame size={30} filled={v.counted} /></span>
      <b className={v.number === 0 ? 'zero' : ''}><Num>{v.number}</Num></b>
      <span className="h-streak-unit">{unitAr(v.number, 'day')}</span>
    </button>
  )
}
