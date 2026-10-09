// ── Settings › وقت التمرين ونوع الجيم ──────────────────────────

import { Num } from '../../components/kit/index.jsx'
import { Barbell, House, Lightning, Sun, SunHorizon, SunDim, MoonStars, Tree } from '@phosphor-icons/react'
import { CheckList, CheckRow } from './parts.jsx'
import { GYM_TYPES, WORKOUT_TIME_HOURS } from '../../constants.js'

export const WORKOUT_TIMES = ['الصباح', 'الظهيرة', 'المساء', 'الليل']
const TIME_ICON = { 'الصباح': SunHorizon, 'الظهيرة': Sun, 'المساء': SunDim, 'الليل': MoonStars }
const GYM_ICON = { commercial: Barbell, home: House, outdoor: Tree, crossfit: Lightning }

export const hourLabel = (time) => `${WORKOUT_TIME_HOURS[time] ?? 17}:00`

export default function PreferencesSection({ profile, update }) {
  return (
    <>
      <CheckList header="متى تتمرن عادة؟" footer="تذكير وقت التمرين يوصلك على هالساعة.">
        {WORKOUT_TIMES.map(t => (
          <CheckRow key={t} leading={TIME_ICON[t]} title={t}
            trailing={<Num>{hourLabel(t)}</Num>}
            checked={profile?.workoutTime === t}
            onClick={() => update('workoutTime', t)} />
        ))}
      </CheckList>

      <CheckList header="وين تتمرن؟">
        {GYM_TYPES.map(g => (
          <CheckRow key={g.id} leading={GYM_ICON[g.id] || Barbell} title={g.label}
            checked={profile?.gymType === g.id}
            onClick={() => update('gymType', g.id)} />
        ))}
      </CheckList>
    </>
  )
}
