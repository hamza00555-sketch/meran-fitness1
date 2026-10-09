import { useState } from 'react'
import { ROUTINES, MUSCLE_GROUPS } from '../constants.js'
import { Sheet, ListGroup, ListRow, Num } from './kit/index.jsx'
import './../styles/screens/session-sheets.css'

// ── Ready-made routines, as a sheet ───────────────────────────
// The kit sheet (portal, scrim, grabber, Escape, focus return) with one
// grouped list: the routine as a word — «دفع», not «Push Day» with an emoji — the
// muscles it trains, and how much is in it. Same contract as before:
// onSelect(routine) then onClose().

const ROUTINE_WORDS = {
  'chest day': 'صدر', 'pull day': 'سحب', 'push day': 'دفع', 'legs day': 'أرجل', 'leg day': 'أرجل',
  'full body': 'جسم كامل', 'upper body': 'الجزء العلوي', 'lower body': 'الجزء السفلي',
}

export const routineName = (r) => {
  const plain = String(r?.name || '').replace(/[^\p{L}\p{N}\s—-]/gu, '').trim()
  return ROUTINE_WORDS[plain.toLowerCase()] || plain
}

export default function RoutinesModal({ onSelect, onClose }) {
  const [open, setOpen] = useState(true)
  // Let the sheet slide away before the parent unmounts it.
  const close = () => { setOpen(false); setTimeout(() => onClose?.(), 220) }

  return (
    <Sheet open={open} onClose={close} title="روتين جاهز">
      <p className="rt-intro">اختر روتين وتبدأ فيه على طول، وتقدر تعدّل التمارين بعدين.</p>
      <ListGroup>
        {ROUTINES.map(r => {
          const sets = r.exercises.reduce((a, e) => a + (e.defaultSets || 3), 0)
          const muscles = r.muscles.map(m => MUSCLE_GROUPS[m]?.label || m).join('، ')
          return (
            <ListRow
              key={r.name}
              title={routineName(r)}
              subtitle={<>{muscles} · <Num>{r.exercises.length}</Num> {r.exercises.length <= 10 ? 'تمارين' : 'تمرين'} · <Num>{sets}</Num> {sets >= 3 && sets <= 10 ? 'مجموعات' : 'مجموعة'}</>}
              chevron
              onClick={() => { onSelect?.(r); close() }}
            />
          )
        })}
      </ListGroup>
    </Sheet>
  )
}
