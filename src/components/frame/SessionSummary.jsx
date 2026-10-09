import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, Num, Gauge } from '../kit/index.jsx'
import { Flame } from '../streak/StreakIcons.jsx'
import { Trophy, Medal, ArrowUp } from '../kit/icons.js'
import { arabicName } from '../../exerciseMedia.js'
import { xpProgress } from '../../utils.js'
import '../../styles/summary.css'

// ── The end of a workout ──────────────────────────────────────
// Finishing used to fire up to five effects in different places and
// queue toasts over the header for 13 seconds or more. Now: one screen,
// beats about a third of a second apart, then still until you tap
// «تم». A tap anywhere jumps to the final frame. The level-up and any
// achievements earned land here instead of on top of you mid-set.

export default function SessionSummary({ summary, xp, onDone }) {
  const [skipped, setSkipped] = useState(false)
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') onDone() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onDone])
  if (!summary) return null
  const { level, currentXP, neededXP } = xpProgress(xp)
  const s = summary
  let beat = 0
  const b = () => ({ '--b': beat++ })

  return createPortal(
    <div className={`sum${skipped ? ' sum-skip' : ''}`} role="dialog" aria-modal="true" aria-label="ملخص الجلسة"
      onClick={() => setSkipped(true)} data-testid="session-summary">
      <div className="sum-body">
        <span className="k-eyebrow sum-beat" style={b()}>انحفظت الجلسة</span>
        <h1 className="sum-title sum-beat" style={b()}>{s.title}</h1>
        <div className="sum-stats sum-beat" style={b()}>
          <span><b><Num>{s.duration}</Num></b><small>دقيقة</small></span>
          <span><b><Num>{s.sets}</Num></b><small>مجموعة</small></span>
          <span><b><Num>{(s.volume / 1000).toFixed(1)}</Num></b><small>طن</small></span>
        </div>

        {s.prs.length > 0 && (
          <section className="sum-sec sum-beat" style={b()}>
            <h2><Trophy size={16} weight="fill" aria-hidden="true" /> أعلى وزن</h2>
            {s.prs.map(p => (
              <div key={p.name} className="sum-pr">
                <span>{arabicName(p.name) || p.name}</span>
                <span className="sum-pr-v"><ArrowUp size={14} weight="bold" aria-hidden="true" /><Num>{p.top}</Num> كجم <small>(كان <Num>{p.prev}</Num>)</small></span>
              </div>
            ))}
          </section>
        )}

        <section className="sum-sec sum-beat" style={b()}>
          <div className="sum-streak">
            <span className="sum-flame"><Flame size={26} filled /></span>
            <span className="sum-streak-n">
              {s.streakBefore !== s.streakAfter && <><Num>{s.streakBefore}</Num> ← </>}
              <b><Num>{s.streakAfter}</Num></b>
            </span>
          </div>
          <p className="sum-line">{s.streakLine}</p>
        </section>

        <section className="sum-sec sum-beat" style={b()}>
          <div className="sum-xp">
            <span>المستوى <Num>{level}</Num></span>
            <span className="sum-xp-gain">+<Num>{s.xp}</Num> XP</span>
          </div>
          <Gauge value={currentXP} max={neededXP} tone="accent" label="التقدم للمستوى الجاي" />
          {s.levelUp && <p className="sum-levelup">مستوى جديد · <Num>{s.levelUp}</Num></p>}
        </section>

        {s.achievements.length > 0 && (
          <section className="sum-sec sum-beat" style={b()}>
            <h2><Medal size={16} weight="fill" aria-hidden="true" /> إنجازات جديدة</h2>
            {s.achievements.map(a => <div key={a.id} className="sum-ach">{a.title}</div>)}
          </section>
        )}
      </div>
      <div className="sum-foot sum-beat" style={b()} onClick={e => e.stopPropagation()}>
        <Button variant="primary" size="lg" full onClick={onDone}>تم</Button>
      </div>
    </div>,
    document.body,
  )
}
