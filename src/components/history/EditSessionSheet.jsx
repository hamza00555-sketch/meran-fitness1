import { Sheet, Button, IconButton, Num } from '../kit/index.jsx'
import { Trash, X } from '../kit/icons.js'
import { arabicName } from '../../exerciseMedia.js'
import { toWesternDigits } from '../../day.js'
import Txt from './Txt.jsx'

// ── Edit a saved session ──────────────────────────────────────
// The same powers the old inline editor had — change a weight or a rep
// count, drop a set, drop an exercise — on the kit: 44pt fields in the
// numeric face, a labelled 44pt remove on each line, the exercise's
// Arabic name first. Exercises are separated by hairlines, not boxes.

export default function EditSessionSheet({ open, onClose, title, dateText, data, mapping = {}, onChange, onSave }) {
  const ex = data || []
  const updSet = (ei, si, field, val) =>
    onChange(ex.map((e, i) => i !== ei ? e : { ...e, sets: e.sets.map((s, j) => j !== si ? s : { ...s, [field]: toWesternDigits(val) }) }))
  const delSet = (ei, si) =>
    onChange(ex.map((e, i) => i !== ei ? e : { ...e, sets: e.sets.filter((_, j) => j !== si) }))
  const delExercise = (ei) => onChange(ex.filter((_, i) => i !== ei))

  // Saving keeps the exercises that still have a done set, as before.
  // With none left there is nothing to save — that is a delete, and it
  // has its own place in the ⋯ menu.
  const keeps = ex.some(e => (e.sets || []).some(s => s.done))

  return (
    <Sheet open={open} onClose={onClose} title="تعديل الجلسة" tall
      footer={(
        <div className="hs-edit-foot">
          <Button variant="primary" size="lg" onClick={onSave} disabled={!keeps} className="hs-grow">حفظ التعديلات</Button>
          <Button variant="secondary" size="lg" onClick={onClose}>إلغاء</Button>
        </div>
      )}>
      <p className="hs-edit-of"><Txt>{title}</Txt> · <Txt>{dateText}</Txt></p>

      {ex.map((e, ei) => {
        const ar = arabicName(e.name, mapping)
        const label = ar || e.name
        return (
          <section key={e.id || ei} className="hs-edit-ex" aria-label={label}>
            <header className="hs-edit-ex-h">
              <span className="hs-ex-name">
                <span className="hs-edit-ex-ar">{ar || <bdi dir="ltr" className="hs-latin">{e.name}</bdi>}</span>
                {ar && <bdi dir="ltr" className="hs-ex-en hs-latin">{e.name}</bdi>}
              </span>
              <IconButton icon={Trash} label={`حذف ${label} من الجلسة`} onClick={() => delExercise(ei)} className="hs-edit-rm hs-edit-rm-ex" />
            </header>

            {e.sets.length > 0 && (
              <div className="hs-edit-grid" role="group" aria-label={`مجموعات ${label}`}>
                <span className="hs-edit-col">#</span>
                <span className="hs-edit-col">الوزن · كجم</span>
                <span aria-hidden="true" />
                <span className="hs-edit-col">التكرار</span>
                <span aria-hidden="true" />
                {e.sets.map((s, si) => (
                  <div key={si} className={s.done ? 'hs-edit-set' : 'hs-edit-set hs-edit-undone'}>
                    <span className="hs-edit-n"><Num>{si + 1}</Num></span>
                    <input type="text" inputMode="decimal" className="hs-field" value={s.weight || ''} placeholder="—"
                      aria-label={`وزن المجموعة ${si + 1}`} onChange={ev => updSet(ei, si, 'weight', ev.target.value)} />
                    <span className="hs-edit-x" aria-hidden="true">×</span>
                    <input type="text" inputMode="numeric" className="hs-field" value={s.reps || ''} placeholder="—"
                      aria-label={`تكرار المجموعة ${si + 1}`} onChange={ev => updSet(ei, si, 'reps', ev.target.value)} />
                    <IconButton icon={X} label={`حذف المجموعة ${si + 1}`} onClick={() => delSet(ei, si)} className="hs-edit-rm" />
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}

      {!keeps && (
        <p className="hs-edit-empty">ما بقى فيها ولا مجموعة. لو تبي تشيلها كلها، احذفها من قائمة ⋯ في السجل.</p>
      )}
    </Sheet>
  )
}
