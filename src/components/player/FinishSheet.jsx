import { Sheet, Button, Num } from '../kit/index.jsx'
import { setsPhrase, clock } from './sessionWords.js'
import { useElapsed } from './SessionBar.jsx'

// ── «إنهاء»: save, throw away, or keep going ──────────────────
// Finishing used to close the session the instant you touched it, and
// with nothing logged it vanished silently. Now it asks, with the real
// cost on the destructive answer: «ستُحذف 3 مجموعات». With nothing
// logged there is nothing to save, so the sheet says so and keeps you
// training unless you choose to throw it away.
//
// The time it quotes is wall-clock since the start, as the bar shows it
// and as the saved session records it; it only ticks while the sheet is
// open.

const Phrase = ({ n }) => {
  const p = setsPhrase(n)
  return <>{p.num != null && <><Num>{p.num}</Num> </>}{p.word}</>
}

export default function FinishSheet({ open, doneSets = 0, startedAt, onSave, onDiscard, onClose }) {
  const none = doneSets === 0
  const elapsed = useElapsed(startedAt, open)
  return (
    <Sheet open={open} onClose={onClose} title="إنهاء الجلسة؟"
      footer={(
        <div className="k-confirm-actions">
          {none ? (
            <>
              <Button variant="primary" size="lg" full onClick={onClose} autoFocus>متابعة التمرين</Button>
              <Button variant="destructive" size="lg" full onClick={onDiscard}>تجاهل الجلسة</Button>
            </>
          ) : (
            <>
              <Button variant="primary" size="lg" full onClick={onSave}>احفظ وأنهِ</Button>
              <button type="button" className="k-btn k-btn-destructive k-btn-lg k-full s-discard" onClick={onDiscard}>
                <span>تجاهل الجلسة</span>
                <span className="s-discard-sub">ستُحذف <Phrase n={doneSets} /></span>
              </button>
              <Button variant="secondary" size="lg" full onClick={onClose} autoFocus>متابعة</Button>
            </>
          )}
        </div>
      )}>
      <p className="k-confirm-msg">
        {none
          ? 'ما سجّلت أي مجموعة بعد، فما فيه شي ينحفظ.'
          : <>سجّلت <Phrase n={doneSets} />{startedAt ? <> في <Num>{clock(elapsed)}</Num></> : null}. تنحفظ في سجلّك.</>}
      </p>
    </Sheet>
  )
}
