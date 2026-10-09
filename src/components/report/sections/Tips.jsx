// ── Chapter 01: what to do about it ───────────────────────────
// First, because advice is what he asked for first. Each tip carries
// the number that produced it, so it can be argued with rather than
// merely believed. Open rows on the ground, hairlines between them;
// the icon's shape says what the tip is about, and only the ticket tip
// takes a colour (blue is rest).

import {
  Warning, Target, CheckCircle, Lightbulb, ArrowsLeftRight, ListChecks,
  ArrowUp, Barbell, ChartLineUp, Drop, CalendarBlank, Ticket, Medal, Trophy, Clock,
} from '../../kit/icons.js'
import { ChartLineDown } from '@phosphor-icons/react'
import { Chapter, Bidi } from '../parts.jsx'

// By what the tip is about first; by how serious it is as a fallback.
const ICON = {
  neglected: Warning,
  pushpull: ArrowsLeftRight,
  untracked: ListChecks,
  ready: ArrowUp,
  stalled: Barbell,
  deload: Drop,
  weekday: CalendarBlank,
  credits: Ticket,
  prdrought: Medal,
  prs: Trophy,
  short: Clock,
  long: Clock,
  form: Lightbulb,
}
const BY_SEVERITY = { alert: Warning, nudge: Target, praise: CheckCircle, info: Lightbulb }

const iconFor = (t) => {
  if (t.id === 'trend') return /نزل/.test(t.title) ? ChartLineDown : ChartLineUp
  return ICON[t.id] || BY_SEVERITY[t.severity] || Lightbulb
}

export default function Tips({ tips = [], n = 1, id = 'rp-tips' }) {
  if (!tips.length) return null
  return (
    <Chapter id={id} n={n} title="نصائح هذا الشهر" note="من أرقام شهرك، مو من قوالب عامة.">
      <ul className="rp-tips">
        {tips.map((t, i) => {
          const Icon = iconFor(t)
          return (
            <li key={t.id} className="rp-tip rp-in" style={{ '--i': i + 1 }} data-severity={t.severity}>
              <span className={`rp-tip-ic${t.id === 'credits' ? ' is-rest' : ''}`} aria-hidden="true">
                <Icon size={20} weight={t.severity === 'alert' ? 'fill' : 'bold'} />
              </span>
              <div className="rp-tip-main">
                <h3 className="rp-tip-t"><Bidi text={t.title} /></h3>
                <p className="rp-tip-b"><Bidi text={t.body} /></p>
                {t.evidence && (
                  <p className="rp-tip-ev">الدليل: <b><Bidi text={t.evidence} /></b></p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Chapter>
  )
}
