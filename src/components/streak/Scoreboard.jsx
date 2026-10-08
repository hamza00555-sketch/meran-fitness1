import { useEffect, useRef, useState } from 'react'
import { streakView } from '../../streak.js'
import { MAX_REST_CREDITS } from '../../recovery.js'
import { ls } from '../../utils.js'
import { Flame, Ticket, Moon, Cross, BADGES } from './StreakIcons.jsx'

// ── The streak, first thing on Home ───────────────────────────
//
// حمزة: «يهمني موضوع الستريك يكون واضح». The number used to sit in a
// header pill that looked the same whether today was done, still owed
// or one missed night from zero, and the only warning lived in a folded
// row under the hero. Now the number is never shown alone: under it,
// one line says what today does to it, the next says until when and at
// what cost, and seven cells say what each recent day did.
//
// Every word comes from streakView(), the same source the header chip,
// the skip sheet and the toasts read.

/** Re-render once a minute so the countdown is never stale. */
function useMinute() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let id
    const tick = () => { setNow(new Date()); id = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50) }
    id = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
    const wake = () => { if (document.visibilityState === 'visible') setNow(new Date()) }
    document.addEventListener('visibilitychange', wake)
    return () => { clearTimeout(id); document.removeEventListener('visibilitychange', wake) }
  }, [])
  return now
}

function Cell({ c }) {
  let glyph = null
  if (c.kind === 'trained' || (c.kind === 'today-done' && !c.rest)) glyph = <i className="sb-dot" />
  else if (c.kind === 'rest' || (c.kind === 'today-done' && c.rest)) glyph = <span className="sb-c-rest"><Moon size={14} /></span>
  else if (c.kind === 'credit') glyph = <span className="sb-c-rest"><Ticket size={14} /></span>
  else if (c.kind === 'missed') glyph = <span className="sb-c-miss"><Cross size={12} /></span>
  else if (c.kind === 'out') glyph = <i className="sb-dim" />
  const ring = c.kind === 'today-pending' ? ' ring' : c.kind === 'today-done' ? ' ring done' : c.kind === 'today-reset' ? ' ring reset' : ''
  const deltaCls = c.delta === '+1' ? ' up' : c.delta === '0' ? ' held' : c.delta ? ' broke' : ''
  return (
    <div className="sb-cell">
      <span className={`sb-cell-d${c.isToday ? ' today' : ''}`}>{c.letter}</span>
      <span className={`sb-cell-g${ring}`}>{glyph}</span>
      <span className={`sb-cell-x${deltaCls}`}>{c.delta}</span>
    </div>
  )
}

export default function Scoreboard({ recovery, config, active, deload, onVisibleChange }) {
  const now = useMinute()
  const v = streakView({ recovery, config, active, deload, now })
  const ref = useRef(null)

  // The header chip stands in for this card once it scrolls away.
  useEffect(() => {
    if (!onVisibleChange || !ref.current || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => onVisibleChange(e.isIntersecting), { threshold: 0 })
    io.observe(ref.current)
    return () => { io.disconnect(); onVisibleChange(true) }
  }, [onVisibleChange])

  // The balance used to stop at 5 on screen while the engine spent from
  // the real one. The first time the true number is larger, say so once.
  // Read during render, written after it, so a double render cannot
  // swallow the one showing.
  const [truthNote] = useState(() =>
    v.tickets > MAX_REST_CREDITS && !ls.get('hf_tickets_truth_seen', false)
      ? `صار عدد التذاكر يبيّن رصيدك الحقيقي (${v.tickets}) — الحد 5 كان شكلي بس.`
      : '')
  useEffect(() => { if (truthNote) ls.set('hf_tickets_truth_seen', true) }, [truthNote])

  const Badge = v.badge ? BADGES[v.badge] : null
  const note = truthNote || v.note

  return (
    <section
      ref={ref}
      className={`sb tone-${v.tone}${v.counted ? ' counted' : ''}`}
      data-testid="streak-board"
      aria-label={v.aria}
    >
      <div className="sb-top">
        <span className="sb-eyebrow">الستريك</span>
        {v.deload && (
          <span className="sb-deload">ديلود · اليوم {v.deload.day} من {v.deload.total}</span>
        )}
        <span className={`sb-tix${v.tickets ? '' : ' empty'}`} data-testid="streak-tickets">
          <Ticket size={15} />{v.ticketsText}
        </span>
      </div>

      <div className="sb-num">
        <span className="sb-flame">
          <Flame size={30} filled={v.counted} />
          {Badge && <span className={`sb-badge ${v.badgeTone}`}><Badge size={12} /></span>}
        </span>
        <b className={`sb-big${v.number === 0 ? ' zero' : ''}`} data-testid="streak-number">{v.number}</b>
        <span className="sb-unit">يوم</span>
        {v.next && (
          <span className="sb-ms">
            <span className="sb-ms-l">المحطة الجاية</span>
            <span><b>{v.next}</b> · باقي {v.next - v.number}</span>
          </span>
        )}
      </div>

      <p className={`sb-status${v.statusWarn ? ' warn' : ''}`} data-testid="streak-status">{v.status}</p>
      {note && <p className="sb-note" data-testid="streak-note">{note}</p>}
      <p className="sb-detail" data-testid="streak-detail">
        {v.countdown && v.lateTail ? (
          <><b className="sb-cd late">باقي {v.countdown}</b> على 3 الفجر · {v.lateTail}</>
        ) : v.countdown ? (
          <>لين 3 الفجر · <b className="sb-cd">باقي {v.countdown}</b>{v.cost ? <> — {v.cost}</> : null}</>
        ) : v.detail}
      </p>

      <div className="sb-chain" role="img" aria-label="آخر 7 أيام">
        {v.chain.map(c => <Cell key={c.date} c={c} />)}
      </div>
    </section>
  )
}
