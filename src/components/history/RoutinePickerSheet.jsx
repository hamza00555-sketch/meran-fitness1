import { Sheet, ListGroup, ListRow } from '../kit/index.jsx'
import { Barbell } from '../kit/icons.js'
import { ROUTINES } from '../../constants.js'
import Txt, { Count } from './Txt.jsx'
import { routineTitle, routineSetCount } from './model.js'

// ── اختر روتين — the ready-made routines, on the kit ──────────
// The same ROUTINES the old RoutinesModal lists, said the way the
// history says a day («سحب — ظهر وبايسبس», «6 تمارين · 19 مجموعة»):
// no emoji, no English titles, no tinted cards — one grouped list, one
// tap starts the routine.

export default function RoutinePickerSheet({ open, onClose, onSelect, routines = ROUTINES }) {
  return (
    <Sheet open={open} onClose={onClose} title="اختر روتين">
      <p className="hs-pick-note">يبدأ التمرين على طول بآخر أوزانك.</p>
      <ListGroup className="hs-pick">
        {routines.map(r => (
          <ListRow
            key={r.name}
            leading={Barbell}
            title={<Txt>{routineTitle(r)}</Txt>}
            subtitle={<><Count n={r.exercises?.length || 0} noun="exercise" /> · <Count n={routineSetCount(r)} noun="set" /></>}
            chevron
            onClick={() => onSelect?.(r)}
          />
        ))}
      </ListGroup>
    </Sheet>
  )
}
