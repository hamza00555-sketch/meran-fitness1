import { useEffect, useState } from 'react'
import { Button, IconButton, Num } from '../kit/index.jsx'
import { CaretDown } from '../kit/icons.js'
import { clock } from './sessionWords.js'

// ── The session's only chrome: 52pt ───────────────────────────
// ⌄ at the start docks the session as the live bar above the tabs. In
// the middle, the day as one word and the clock: «دفع · 07:42». At the
// end, «إنهاء» — green text, because finishing is a completion, not a
// danger — which asks before it does anything. No red here, and no
// «تراجع»: throwing the session away lives in ⋯ and in the finish sheet.
//
// The clock is wall-clock time since the session began — the same number
// finishing saves as its duration — so it never pauses for a rest, and
// minimising and reopening can't make it jump. It ticks here, and only
// here: the player under it doesn't re-render once a second for it.

/** Seconds since `startedAt`, re-read once a second while mounted. */
export function useElapsed(startedAt, running = true) {
  const read = () => (startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0)
  const [secs, setSecs] = useState(read)
  useEffect(() => {
    if (!running || !startedAt) return
    let t = 0
    const tick = () => {
      setSecs(read())
      // align to the next whole second since the start
      const ms = 1000 - ((Date.now() - startedAt) % 1000)
      t = setTimeout(tick, ms + 10)
    }
    tick()
    const sync = () => setSecs(read())
    document.addEventListener('visibilitychange', sync)
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', sync) }
  }, [startedAt, running]) // eslint-disable-line react-hooks/exhaustive-deps
  // The state only drives the once-a-second render; the number is read
  // fresh, so a sheet opening after minutes closed shows the truth at once.
  return running ? Math.max(secs, read()) : secs
}

export default function SessionBar({ title, startedAt, onMinimize, onFinish }) {
  const elapsed = useElapsed(startedAt)
  return (
    <header className="s-bar">
      <div className="s-bar-start">
        {onMinimize && (
          <IconButton icon={CaretDown} label="صغّر الجلسة" weight="bold" onClick={onMinimize} />
        )}
      </div>
      <div className="s-bar-title" data-testid="session-title">
        <span className="s-bar-day">{title}</span>
        <span className="s-bar-dot" aria-hidden="true">·</span>
        <Num className="s-bar-time">{clock(elapsed)}</Num>
      </div>
      <div className="s-bar-end">
        <Button variant="plain" size="md" className="s-bar-finish" onClick={onFinish}>إنهاء</Button>
      </div>
    </header>
  )
}
