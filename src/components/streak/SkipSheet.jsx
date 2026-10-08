import { createPortal } from 'react-dom'

// ── Before «تخطي اليوم» ───────────────────────────────────────
// Skipping moves the plan to its next day and nothing else: the streak
// engine still expects a workout today, so at 03:00 the day costs a
// ticket or the streak. The button used to say «تم تخطي يوم التمرين»
// and let that happen without a word. Now the cost is stated first.
// Two quiet buttons, no green: neither choice is the one to push.

export default function SkipSheet({ copy, onConfirm, onClose }) {
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
