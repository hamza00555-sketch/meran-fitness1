// ── The last rung of the share ladder ─────────────────────────
// When the share sheet is unavailable and a download attribute does
// nothing — the ordinary case for an installed PWA on iOS — the only
// route left is to put the image on screen and let the user press and
// hold it. That always works, so it is worth doing properly: the kit's
// one bottom sheet, a title that says what this is, the instruction as
// a caption, and a quiet «تم».

import { Sheet, Button } from '../kit/index.jsx'
import '../../styles/screens/report.css'

export default function SavePosterSheet({ url, onClose }) {
  if (!url) return null
  return (
    <Sheet
      open
      onClose={onClose}
      title="احفظ الصورة"
      footer={<Button variant="secondary" size="lg" full onClick={onClose}>تم</Button>}
    >
      <div className="rp-save">
        <p className="rp-save-cap">اضغط مطوّلاً على الصورة، ثم اختر «حفظ الصورة» أو «إضافة إلى الصور».</p>
        <img
          className="rp-save-img"
          src={url}
          alt="صورة تقرير الشهر"
        />
      </div>
    </Sheet>
  )
}
