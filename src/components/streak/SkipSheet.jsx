import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// ── Before «تخطي اليوم» ───────────────────────────────────────
// Skipping moves the plan to its next day and nothing else: the streak
// engine still expects a workout today, so at 03:00 the day costs a
// ticket or the streak. The button used to say «تم تخطي يوم التمرين»
// and let that happen without a word. Now the cost is stated first.
// Two quiet buttons, no green: neither choice is the one to push.

export default function SkipSheet({ copy, onConfirm, onClose }) {
  // Like the app's other sheets: Escape closes, the page behind neither
  // scrolls nor takes focus, and focus goes back to the button that
  // opened it.
  // The opener is read during render: «رجوع» takes focus (autoFocus)
  // before any effect runs, so reading it there would return focus to
  // the sheet itself.
  const [opener] = useState(() => document.activeElement)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const root = document.getElementById('root')
    if (root) root.inert = true
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') close.current() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      if (root) root.inert = false
      opener?.focus?.()
    }
  }, [opener])

  return createPortal(
    <div className="skip-sheet-scrim" onClick={onClose} role="presentation">
      <div
        className="skip-sheet"
        role="dialog" aria-modal="true" aria-labelledby="skip-sheet-title"
        onClick={e => e.stopPropagation()}
        data-testid="skip-sheet"
      >
        <span className="skip-sheet-grab" aria-hidden="true" />
        <h2 id="skip-sheet-title">{copy.title}</h2>
        <p className={copy.warn ? 'warn' : ''}>{copy.body}</p>
        <div className="skip-sheet-actions">
          <button type="button" onClick={onConfirm} data-testid="skip-confirm">{copy.confirm}</button>
          <button type="button" onClick={onClose} autoFocus>{copy.cancel}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
