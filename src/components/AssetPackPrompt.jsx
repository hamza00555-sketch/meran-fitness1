// ── The offer to download the art pack ────────────────────────
// Shown once per device, after the version notice is dismissed —
// which is the one guaranteed first interaction, and a user gesture
// is the right thing to hang a multi-megabyte download off.
//
// Its condition is the reconciliation against IndexedDB, never a
// per-user flag: the pack belongs to the device, so a second profile
// must not be asked to install something that is already there.
//
// The kit's sheet, and it shows what it is selling: three of the
// medals already bundled with the app, on a lit stage, so «صور مران»
// is a picture and not just a sentence (critique F45). The size is
// quoted when the manifest has been fetched.

import { useCallback, useEffect, useRef, useState } from 'react'
import { installPack, markPrompted, usePackState } from '../assets/pack.js'
import { Sheet, Button, Num } from './kit/index.jsx'
import { useScreenClear } from './system/layers.js'
import '../styles/screens/system.css'

const SAMPLES = ['/assets/ach_consistency.webp', '/assets/ach_strength.webp', '/assets/ach_volume.webp']

const mb = (bytes) => {
  const v = bytes / (1024 * 1024)
  return v >= 10 ? Math.round(v) : Math.round(v * 10) / 10
}

export default function AssetPackPrompt({ onClose }) {
  const pack = usePackState()
  // A calm moment only: never over the workout player (a session restored
  // at launch), the summary or another sheet. It waits, unmarked, until
  // the screen is clear, then opens and stays open.
  const [started, setStarted] = useState(false)
  const clear = useScreenClear(!started)
  useEffect(() => { if (clear) setStarted(true) }, [clear])
  const [closing, setClosing] = useState(false)
  const done = useRef(false)

  // Mark first, act, then let the sheet leave before the parent unmounts it.
  const leave = useCallback(() => {
    if (done.current) return false
    done.current = true
    markPrompted()
    setClosing(true)
    setTimeout(() => onClose?.(), 230)
    return true
  }, [onClose])
  const dismiss = useCallback(() => { leave() }, [leave])
  const accept  = useCallback(() => { if (leave()) installPack() }, [leave])

  const size = pack?.remoteBytes > 0 ? mb(pack.remoteBytes) : null

  return (
    <Sheet
      open={started && !closing}
      onClose={dismiss}
      title="صور مران"
      footer={(
        <div className="sys-pack-actions">
          <Button variant="secondary" size="lg" full onClick={dismiss} data-pack="offer-later">بعدين</Button>
          <Button variant="primary" size="lg" full onClick={accept} data-pack="offer-accept">نزّلها الحين</Button>
        </div>
      )}
    >
      <div data-pack-prompt="">
        <div className="sys-pack-stage" aria-hidden="true">
          {SAMPLES.map(src => <img key={src} src={src} alt="" loading="eager" decoding="async" />)}
        </div>
        <p className="sys-pack-text">
          رسومات الجوائز ولحظات الاحتفال، مرسومة بنفس أسلوب التطبيق.
          تنزل مرة وحدة وتشتغل بعدها بدون نت.
        </p>
        <p className="sys-pack-meta">
          {size != null ? <>الحجم تقريباً <Num>{size}</Num> م.ب · </> : null}
          تقدر تنزّلها بعدين من الإعدادات.
        </p>
      </div>
    </Sheet>
  )
}
