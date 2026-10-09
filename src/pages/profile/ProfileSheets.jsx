// ── Profile › the sheets ──────────────────────────────────────
// Everything the profile edits opens in a bottom sheet over the page:
// one body value, the goal, the training system, the measurements, the
// protein calculator. Stored shapes are the ones ProfilePage always
// wrote — the old design reads the same profile.

import { useEffect, useState } from 'react'
import { Sheet, Button, Segmented, ListGroup, Num } from '../../components/kit/index.jsx'
import { CheckList, CheckRow, TextField, Ar } from '../settings/parts.jsx'
import { GOALS } from '../../constants.js'
import { calcAge } from '../../utils.js'
import { toWesternDigits, calendarKey } from '../../day.js'
import { fmtDayAr } from '../../streak.js'

// ── Shared vocabulary ─────────────────────────────────────────
export const BODY_FIELDS = {
  weight:   { label: 'الوزن',        unit: 'كجم', numeric: true },
  height:   { label: 'الطول',        unit: 'سم',  numeric: true },
  bodyFat:  { label: 'نسبة الدهون',  unit: '%',   numeric: true },
  birthday: { label: 'تاريخ الميلاد', type: 'date' },
}

// The most commonly tracked measurements, all in cm.
export const BODY_MEASUREMENTS = [
  { id: 'neck',      label: 'الرقبة' },
  { id: 'shoulders', label: 'الأكتاف' },
  { id: 'chest',     label: 'الصدر' },
  { id: 'biceps',    label: 'البايسبس' },
  { id: 'forearm',   label: 'الساعد' },
  { id: 'waist',     label: 'الخصر' },
  { id: 'hips',      label: 'الأرداف' },
  { id: 'thigh',     label: 'الفخذ' },
  { id: 'calf',      label: 'السمانة' },
]

// Arabic first; the familiar split name second, in the Latin face.
export const TRAINING_SYSTEMS = [
  { id: 'ppl',         label: 'دفع، سحب، أرجل', en: 'PPL' },
  { id: 'upper-lower', label: 'علوي وسفلي',      en: 'Upper / Lower' },
  { id: 'full-body',   label: 'الجسم كامل',      en: 'Full Body' },
  { id: 'bro-split',   label: 'عضلة لكل يوم',    en: 'Bro Split' },
  { id: 'custom',      label: 'مخصص',            en: null, desc: 'حسب جدولك' },
]

const hasValue = (v) => v !== null && v !== undefined && v !== ''

// ── One body value ────────────────────────────────────────────
export function EditSheet({ open, field, profile, onClose, onSave }) {
  const f = BODY_FIELDS[field] || {}
  const [value, setValue] = useState('')
  useEffect(() => {
    if (open && field) setValue(hasValue(profile?.[field]) ? String(profile[field]) : '')
  }, [open, field]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => { onSave(field, f.numeric ? toWesternDigits(value).trim() : value); onClose() }

  return (
    <Sheet open={open} onClose={onClose} title={f.label}
      footer={<Button variant="primary" size="lg" full onClick={save}>حفظ</Button>}>
      <div className="pf-edit">
        <TextField key={field} aria-label={f.label} autoFocus value={value} enterKeyHint="done"
          numeric={f.numeric} unit={f.unit}
          {...(f.type === 'date' ? { type: 'date', dir: 'ltr' } : {})}
          onChange={e => setValue(f.numeric ? toWesternDigits(e.target.value) : e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save() }} />
      </div>
    </Sheet>
  )
}

// ── The goal ──────────────────────────────────────────────────
export function GoalSheet({ open, value, onClose, onPick }) {
  return (
    <Sheet open={open} onClose={onClose} title="هدفك">
      <CheckList label="هدفك">
        {GOALS.map(g => (
          <CheckRow key={g.id} checked={value === g.id}
            leading={g.img ? <img className="pf-goal-img" src={g.img} alt="" /> : null}
            title={g.label} subtitle={g.desc}
            onClick={() => { onPick(g.id); onClose() }} />
        ))}
      </CheckList>
    </Sheet>
  )
}

// ── The training system ───────────────────────────────────────
export function SystemSheet({ open, value, onClose, onPick }) {
  return (
    <Sheet open={open} onClose={onClose} title="نظام التدريب">
      <CheckList label="نظام التدريب">
        {TRAINING_SYSTEMS.map(s => (
          <CheckRow key={s.id} checked={value === s.id} title={s.label}
            subtitle={s.en ? <span className="pf-en" dir="ltr">{s.en}</span> : s.desc}
            onClick={() => { onPick(s.id); onClose() }} />
        ))}
      </CheckList>
    </Sheet>
  )
}

// ── Measurements ──────────────────────────────────────────────
// Each row is its own field. A value is written when you leave it, and
// every changed value is written again in one update when the sheet
// closes («تم», ×, the scrim): on iOS a tap on «تم» leaves the focus in
// the field and no blur ever comes.
const cleanMeasure = (v) => toWesternDigits(String(v ?? '')).trim()

export function MeasurementsSheet({ open, profile, onClose, onUpdateProfile }) {
  const saved = profile?.measurements || {}
  const [draft, setDraft] = useState(saved)
  useEffect(() => { if (open) setDraft(profile?.measurements || {}) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Only what differs from what is stored; nothing changed, nothing written.
  const write = (ids) => {
    const dirty = {}
    for (const id of ids) {
      if (!(id in draft)) continue
      const v = cleanMeasure(draft[id])
      if (cleanMeasure(saved[id]) !== v) dirty[id] = v
    }
    if (!Object.keys(dirty).length) return
    onUpdateProfile({
      ...profile,
      measurements: { ...saved, ...dirty },
      lastMeasurementsUpdate: new Date().toISOString(),
    })
  }
  const commit = (id) => write([id])
  const finish = () => { write(BODY_MEASUREMENTS.map(m => m.id)); onClose() }

  const last = profile?.lastMeasurementsUpdate
  return (
    <Sheet open={open} onClose={finish} title="القياسات" tall
      footer={<Button variant="primary" size="lg" full onClick={finish}>تم</Button>}>
      <ListGroup className="st-area" footer={last ? <Ar>{`آخر تحديث ${fmtDayAr(calendarKey(new Date(last)), { weekday: false })}`}</Ar> : 'بالسنتيمتر. اكتب الرقم وينحفظ.'}>
        {BODY_MEASUREMENTS.map(m => (
          <label key={m.id} className="k-row pf-mrow">
            <span className="k-row-main"><span className="k-row-title">{m.label}</span></span>
            <span className="pf-minput">
              <input type="text" inputMode="decimal" dir="ltr" placeholder="—" enterKeyHint="next"
                aria-label={`${m.label} بالسنتيمتر`}
                value={draft[m.id] ?? ''}
                onChange={e => setDraft(d => ({ ...d, [m.id]: toWesternDigits(e.target.value) }))}
                onBlur={() => commit(m.id)}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
              <span>سم</span>
            </span>
          </label>
        ))}
      </ListGroup>
    </Sheet>
  )
}

// ── Protein ───────────────────────────────────────────────────
export const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'قليل',  mult: 1.2,   desc: 'مكتب وبدون رياضة' },
  { id: 'light',     label: 'خفيف',  mult: 1.375, desc: '1–3 أيام في الأسبوع' },
  { id: 'moderate',  label: 'متوسط', mult: 1.55,  desc: '3–5 أيام في الأسبوع' },
  { id: 'active',    label: 'نشيط',  mult: 1.725, desc: '6–7 أيام في الأسبوع' },
]
const PROTEIN_FACTORS = { muscle: 2.0, fat_loss: 2.2, strength: 1.8, endurance: 1.6, recomp: 2.2, maintain: 1.6 }
const CALORIE_ADJUST  = { muscle: 350, fat_loss: -400, strength: 200, endurance: 150, recomp: 0, maintain: 0 }

export function proteinPlan(profile, activity) {
  const weight = parseFloat(profile?.weight) || null
  const height = parseFloat(profile?.height) || null
  const age    = calcAge(profile?.birthday) || null
  const goal   = profile?.goal || 'muscle'
  const factor = PROTEIN_FACTORS[goal] || 2.0
  const protein = weight ? Math.round(weight * factor) : null
  let calories = null, fatG = null, carbG = null
  if (weight && height && age) {
    const bmr  = 88.36 + 13.4 * weight + 4.8 * height - 5.7 * age
    const mult = ACTIVITY_LEVELS.find(a => a.id === activity)?.mult || 1.55
    calories   = Math.round(bmr * mult + (CALORIE_ADJUST[goal] || 0))
    const protCals = (protein || 0) * 4
    const fatCals  = Math.round(calories * 0.27)
    fatG  = Math.round(fatCals / 9)
    carbG = Math.round((calories - protCals - fatCals) / 4)
  }
  return { weight, height, age, factor, protein, calories, fatG, carbG, missing: !weight || !height || !age }
}

export function ProteinSheet({ open, profile, activity, setActivity, onClose, onEdit }) {
  const p = proteinPlan(profile, activity)
  const act = ACTIVITY_LEVELS.find(a => a.id === activity) || ACTIVITY_LEVELS[2]
  return (
    <Sheet open={open} onClose={onClose} title="حاسبة البروتين">
      {p.missing ? (
        <div className="pf-protein-missing">
          <p className="k-confirm-msg">نحتاج وزنك وطولك وتاريخ ميلادك عشان نحسب احتياجك اليومي.</p>
          <div className="st-actions" style={{ marginTop: 16 }}>
            {!p.weight && <Button variant="secondary" full onClick={() => onEdit('weight')}>أضف الوزن</Button>}
            {!p.height && <Button variant="secondary" full onClick={() => onEdit('height')}>أضف الطول</Button>}
            {!p.age && <Button variant="secondary" full onClick={() => onEdit('birthday')}>أضف تاريخ الميلاد</Button>}
          </div>
        </div>
      ) : (
        <div className="pf-protein">
          <div className="pf-protein-hero">
            <span className="k-eyebrow">بروتين في اليوم</span>
            <p><b><Num>{p.protein}</Num></b><span>جرام</span></p>
            <span className="pf-protein-how"><Ar>{`${p.factor} جرام لكل كيلو من وزنك، ووزنك ${p.weight} كجم`}</Ar></span>
          </div>

          <div className="pf-field-block">
            <span className="st-field-label">نشاطك اليومي</span>
            <Segmented label="نشاطك اليومي" value={activity} onChange={setActivity}
              options={ACTIVITY_LEVELS.map(a => ({ value: a.id, label: a.label }))} />
            <span className="st-field-hint"><Ar>{act.desc}</Ar></span>
          </div>

          {p.calories && (
            <div className="pf-macros">
              <div><b><Num>{p.calories.toLocaleString('en-US')}</Num></b><span>سعرة</span></div>
              <div><b><Num>{p.fatG}</Num></b><span>جرام دهون</span></div>
              <div><b><Num>{p.carbG}</Num></b><span>جرام كارب</span></div>
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}
