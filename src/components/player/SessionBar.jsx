import { Button, IconButton, Num } from '../kit/index.jsx'
import { CaretDown } from '../kit/icons.js'

// ── The session's only chrome: 52pt ───────────────────────────
// ⌄ at the start docks the session as the live bar above the tabs. In
// the middle, the day as one word and the clock: «دفع · 07:42». At the
// end, «إنهاء» — green text, because finishing is a completion, not a
// danger — which asks before it does anything. No red here, and no
// «تراجع»: throwing the session away lives in ⋯ and in the finish sheet.

export default function SessionBar({ title, elapsed, onMinimize, onFinish }) {
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
        <Num className="s-bar-time">{elapsed}</Num>
      </div>
      <div className="s-bar-end">
        <Button variant="plain" size="md" className="s-bar-finish" onClick={onFinish}>إنهاء</Button>
      </div>
    </header>
  )
}
