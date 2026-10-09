import { useState } from 'react'
import { MUSCLE_GROUPS } from '../constants.js'
import { arabicName } from '../exerciseMedia.js'
import { Sheet, ListGroup, ListRow, Chip, Segmented, Button } from './kit/index.jsx'
import { Check, PencilSimple } from './kit/icons.js'
import './../styles/screens/session-sheets.css'

// ── Add an exercise, as a sheet ───────────────────────────────
// Muscle as a row of neutral chips (colour is state, not a muscle's
// hue), the exercises as a list — Arabic name first, the English under
// it in the Latin face — a custom name when the list lacks one, the
// number of sets as a segmented control, and one green action at the
// foot. Same contract: onAdd({ muscle, name, numSets }) then onClose().

export default function AddExerciseModal({ onAdd, onClose }) {
  const muscles = Object.keys(MUSCLE_GROUPS)
  const [open, setOpen]             = useState(true)
  const [muscle, setMuscle]         = useState('Chest')
  const [selectedEx, setSelectedEx] = useState(null)
  const [customName, setCustomName] = useState('')
  const [isCustom, setIsCustom]     = useState(false)
  const [numSets, setNumSets]       = useState(3)

  const group     = MUSCLE_GROUPS[muscle]
  const finalName = isCustom ? customName : selectedEx?.name
  const canAdd    = Boolean(finalName?.trim())
  const shownName = isCustom ? customName.trim() : (arabicName(finalName || '') || finalName)

  const close = () => { setOpen(false); setTimeout(() => onClose?.(), 220) }

  const handleAdd = () => {
    if (!canAdd) return
    onAdd({ muscle, name: finalName.trim(), numSets })
    close()
  }

  return (
    <Sheet open={open} onClose={close} title="إضافة تمرين" tall
      footer={(
        <Button variant="primary" size="lg" full icon={canAdd ? Check : undefined} disabled={!canAdd} onClick={handleAdd}>
          {canAdd ? <span className="ax-cta">أضف <bdi>{shownName}</bdi></span> : 'اختر تمريناً أولاً'}
        </Button>
      )}>
      <div className="ax-chips" role="group" aria-label="العضلة">
        {muscles.map(m => (
          <Chip key={m} selected={muscle === m}
            onClick={() => { setMuscle(m); setSelectedEx(null); setIsCustom(false) }}>
            {MUSCLE_GROUPS[m].label}
          </Chip>
        ))}
      </div>

      <ListGroup header={`تمارين ${group.label}`}>
        {group.exercises.map(ex => {
          const on = !isCustom && selectedEx?.name === ex.name
          const ar = arabicName(ex.name)
          return (
            <ListRow
              key={ex.name}
              title={ar || <bdi dir="ltr">{ex.name}</bdi>}
              subtitle={ar ? <bdi dir="ltr" className="ax-en">{ex.name}</bdi> : null}
              trailing={on ? <Check size={20} weight="bold" className="ax-check" aria-label="مختار" /> : null}
              className={on ? 'ax-on' : undefined}
              onClick={() => { setSelectedEx(ex); setIsCustom(false) }}
            />
          )
        })}
        <ListRow
          leading={PencilSimple}
          title="تمرين مخصص"
          subtitle="اكتب اسمه بنفسك"
          trailing={isCustom ? <Check size={20} weight="bold" className="ax-check" aria-label="مختار" /> : null}
          className={isCustom ? 'ax-on' : undefined}
          onClick={() => { setIsCustom(true); setSelectedEx(null) }}
        />
      </ListGroup>

      {isCustom && (
        <input
          autoFocus
          className="ax-input"
          placeholder="اسم التمرين…"
          value={customName}
          onChange={e => setCustomName(e.target.value)}
        />
      )}

      <div className="ax-sets">
        <span className="k-eyebrow">عدد المجموعات</span>
        <Segmented
          label="عدد المجموعات"
          value={numSets}
          onChange={setNumSets}
          options={[2, 3, 4, 5].map(n => ({ value: n, label: <bdi dir="ltr" className="k-num">{n}</bdi> }))}
        />
      </div>
    </Sheet>
  )
}
