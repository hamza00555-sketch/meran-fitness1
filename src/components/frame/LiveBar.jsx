import { useEffect, useState } from 'react'
import { Barbell, CaretUp } from '../kit/icons.js'
import { Num } from '../kit/index.jsx'

// ── The running session, docked above the tabs ────────────────
// Minimising the session used to leave a 7px dot on a tab. Now it is a
// 56pt bar you cannot miss: what is running, for how long, and one tap
// back into it.

function elapsed(startMs) {
  const s = Math.max(0, Math.floor((Date.now() - startMs) / 1000))
  const m = Math.floor(s / 60), r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

export default function LiveBar({ active, title, onOpen }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const all = (active?.exercises || []).flatMap(e => e.sets || [])
  const done = all.filter(s => s.done).length
  return (
    <button type="button" className="f-livebar" onClick={onOpen} data-testid="live-bar"
      aria-label={`الجلسة شغّالة — ${title}، ارجع لها`}>
      <span className="f-livebar-dot" aria-hidden="true" />
      <Barbell size={20} weight="bold" aria-hidden="true" />
      <span className="f-livebar-title">{title}</span>
      <span className="f-livebar-meta"><Num>{done}/{all.length}</Num> · <Num>{elapsed(Number(active?.id) || Date.now())}</Num></span>
      <CaretUp size={18} weight="bold" aria-hidden="true" />
    </button>
  )
}
