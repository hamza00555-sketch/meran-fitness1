import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../kit/index.jsx'
import { withNums } from '../home/HomeBits.jsx'
import { lockScroll } from '../../scrollLock.js'

// ── Before «تخطي اليوم» ───────────────────────────────────────
// Skipping moves the plan to its next day and nothing else: the streak
// engine still expects a workout today, so at 03:00 the day costs a
// ticket or the streak. The cost is stated first. Two quiet buttons, no
// green: neither choice is the one to push.
//
// Drawn on the kit's sheet (grabber, title, body, footer) but kept as
// its own component so the dialog carries data-testid="skip-sheet" and
// the confirm "skip-confirm", which the e2e suite and the screenshot
// manifest address it by.

export default function SkipSheet({ copy, onConfirm, onClose }) {
  // Escape closes, the page behind neither scrolls nor takes focus, and
  // focus goes back to the button that opened it. The opener is read
  // during render: «رجوع» takes focus (autoFocus) before any effect
  // runs, so reading it there would return focus to the sheet itself.
  const [opener] = useState(() => document.activeElement)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const release = lockScroll({ inert: true })
    const onKey = (e) => { if (e.key === 'Escape') close.current() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      release()
      opener?.focus?.()
    }
  }, [opener])

  return createPortal(
    <div className="k-scrim" onClick={onClose} role="presentation">
      <div
        className="k-sheet skip-sheet-k"
        role="dialog" aria-modal="true" aria-labelledby="skip-sheet-title"
        onClick={e => e.stopPropagation()}
        data-testid="skip-sheet"
      >
        <span className="k-sheet-grab" aria-hidden="true" />
        <div className="k-sheet-h">
          <h2 id="skip-sheet-title">{copy.title}</h2>
        </div>
        <div className="k-sheet-body">
          <p className={`skip-sheet-msg${copy.warn ? ' warn' : ''}`}>{withNums(copy.body)}</p>
        </div>
        <div className="k-sheet-foot">
          <div className="skip-sheet-k-actions">
            <Button variant="secondary" size="lg" full onClick={onConfirm} data-testid="skip-confirm">{copy.confirm}</Button>
            <Button variant="secondary" size="lg" full onClick={onClose} autoFocus>{copy.cancel}</Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
