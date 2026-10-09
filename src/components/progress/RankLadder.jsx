import { RANKS } from '../../constants.js'
import { getRank } from '../../utils.js'
import { Num } from '../kit/index.jsx'

// ── The rank ladder E → S+ ────────────────────────────────────
//
// Seven letters on one line that reads from the start edge: E on the
// right, S+ on the left, the filled run growing toward the end of the
// line the way every progress bar in the app does. The current rank is
// a ring in the accent; ranks behind it are filled neutral; ranks ahead
// are outlines. Under it, the one sentence that matters: how many levels
// to the next letter.

/** «مستوى واحد» · «مستويين» · «3 مستويات» · «12 مستوى» — Arabic counting. */
export function levelsLeft(n) {
  if (n === 1) return 'مستوى واحد'
  if (n === 2) return 'مستويين'
  if (n >= 3 && n <= 10) return <><Num>{n}</Num> مستويات</>
  return <><Num>{n}</Num> مستوى</>
}

export default function RankLadder({ level, className, caption = true }) {
  const rank = getRank(level)
  const idx = Math.max(0, RANKS.findIndex(r => r.tier === rank.tier))
  const next = RANKS[idx + 1]
  // The run fills to the current node, plus the share of the way to
  // the next one.
  const within = next ? Math.max(0, Math.min(1, (level - rank.minLevel) / (next.minLevel - rank.minLevel))) : 0
  const fill = (idx + within) / (RANKS.length - 1)

  return (
    <div className={`rl${className ? ' ' + className : ''}`}>
      <ol className="rl-track" aria-label="سلّم الرتب">
        <i className="rl-line" aria-hidden="true"><b style={{ transform: `scaleX(${fill})` }} /></i>
        {RANKS.map((r, i) => (
          <li key={r.tier}
            className={`rl-node${i < idx ? ' rl-past' : ''}${i === idx ? ' rl-now' : ''}`}
            aria-current={i === idx ? 'step' : undefined}
            aria-label={`${r.tier} · ${r.label}${i === idx ? ' — رتبتك' : ''}`}>
            <bdi dir="ltr">{r.tier}</bdi>
          </li>
        ))}
      </ol>
      {caption && (
        <p className="rl-cap">
          {next
            ? <>باقي {levelsLeft(next.minLevel - level)} على <Num>{next.tier}</Num> · {next.label}</>
            : <>وصلت أعلى رتبة</>}
        </p>
      )}
    </div>
  )
}
