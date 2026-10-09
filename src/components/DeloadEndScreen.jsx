import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Art, { useHasArt } from '../assets/Art.jsx'
import { toWesternDigits } from '../day.js'
import { dayDiff } from '../recovery.js'
import { arabicName } from '../exerciseMedia.js'
import { Button, Num } from './kit/index.jsx'
import '../styles/screens/celebrate.css'

/**
 * Shown once, on the first open after a deload closes.
 *
 * The whole design of the deload is that nothing needs restoring — the
 * app simply stopped writing lighter weights over the baseline. That is
 * reassuring but invisible, so this screen makes it visible: here is
 * the weight you are going back to, and it is the same one you left.
 *
 * `heaviest` is the single lift that best answers "back to what" — a
 * number the user recognises beats a sentence promising one.
 *
 * Same calm structure as the level-up: it wipes in, the eyebrow turns
 * from the deload's ice back to the green (the room warming up again),
 * the returning weight is the one big number, then «يلا نكمل» and still.
 */
export default function DeloadEndScreen({ entry, heaviest, onDismiss }) {
  const days = entry ? dayDiff(entry.from, entry.until || entry.plannedUntil) + 1 : 0
  const pct = entry?.pct != null ? toWesternDigits(entry.pct) : null
  const hasArt = useHasArt('deload_end')
  const foot = useRef(null)
  const ar = heaviest ? arabicName(heaviest.name) : null

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onDismiss?.() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => foot.current?.closest('.cel')?.focus({ preventScroll: true }), 0)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; clearTimeout(t) }
  }, [onDismiss])

  return createPortal(
    <div className="cel cel-deload" role="dialog" aria-modal="true" aria-labelledby="de-title" data-testid="deload-end" tabIndex={-1}>
      <div className="cel-body">
        {hasArt && <Art id="deload_end" size={120} className="cel-art cel-beat" style={{ '--b': 0 }} />}
        <span className="cel-eyebrow cel-thaw cel-beat" style={{ '--b': 0 }}>
          <span className="cel-thaw-ice" aria-hidden="true">رجعت للأوزان الكاملة</span>
          <span>رجعت للأوزان الكاملة</span>
        </span>
        <h1 className="cel-title cel-beat" style={{ '--b': 1 }} id="de-title">خلص الديلود</h1>
        <p className="cel-text cel-beat" style={{ '--b': 1 }}>
          {days > 0 && <><Num>{days}</Num> {days === 1 ? 'يوم' : days === 2 ? 'يومين' : 'أيام'}{pct != null && <> بأوزان أخف بـ<Num>{pct}%</Num></>}. </>}
          أوزانك رجعت كما كانت بالضبط — ما ضاع منها شي.
        </p>

        {heaviest && (
          <div className="cel-return cel-beat" style={{ '--b': 2 }}>
            <span className="cel-return-label">ترجع إلى</span>
            <div className="cel-return-n">
              <Num className="cel-return-w">{toWesternDigits(heaviest.weight)}</Num>
              <span className="cel-return-u">كجم</span>
            </div>
            <span className="cel-return-name">
              {ar || <bdi dir="ltr">{heaviest.name}</bdi>}
              {ar && <bdi dir="ltr" className="cel-return-en">{heaviest.name}</bdi>}
            </span>
          </div>
        )}
      </div>

      <div className="cel-foot cel-beat" style={{ '--b': 3 }} ref={foot}>
        <Button variant="primary" size="lg" full onClick={onDismiss}>يلا نكمل</Button>
      </div>
    </div>,
    document.body,
  )
}
