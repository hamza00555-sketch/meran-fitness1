// ── Settings › التكرارات ──────────────────────────────────────
// The rep range the double-progression engine works inside.

import { Chip } from '../../components/kit/index.jsx'
import { CheckList, CheckRow, TextField, Ar } from './parts.jsx'
import { REP_TARGETS, repTargetOf, DEFAULT_REP_TARGET } from '../../progression.js'
import { toWesternDigits } from '../../day.js'

// progression.js keeps its descriptions with Arabic-Indic digits.
const NOTE = { strength: 'أوزان ثقيلة', muscle: 'المدى المعروف', volume: 'عدات أعلى', endurance: 'وزن أخف' }
const repsDesc = (t) => NOTE[t.id] ? `${t.base}–${t.top} عدة · ${NOTE[t.id]}` : toWesternDigits(t.desc || '')

export default function RepsSection({ repTarget = DEFAULT_REP_TARGET, onUpdateRepTarget }) {
  const r = repTargetOf(repTarget)
  return (
    <>
      <CheckList header="كم عدة تبي في المجموعة؟"
        footer={(
          <>
            <div className="st-steps" aria-label="كيف يرفع التطبيق الوزن">
              <Chip><Ar>{`${r.base} عدة`}</Ar></Chip><span className="st-steps-arrow" aria-hidden="true">←</span>
              <Chip><Ar>{`${r.top} عدة`}</Ar></Chip><span className="st-steps-arrow" aria-hidden="true">←</span>
              <Chip tone="raise">ارفع وزنك</Chip>
            </div>
            <p>نثبّت الوزن ونزيد العدات لين توصل لأعلى المدى، وبعدها نقول لك ارفع الوزن.</p>
          </>
        )}>
        {REP_TARGETS.map(t => (
          <CheckRow key={t.id} title={t.label} subtitle={<Ar>{repsDesc(t)}</Ar>}
            checked={repTarget.id === t.id}
            onClick={() => onUpdateRepTarget?.({ id: t.id, base: t.base, top: t.top })} />
        ))}
        <CheckRow title="مخصص" subtitle="أنت تحدد أقل وأعلى عدد"
          checked={repTarget.id === 'custom'}
          onClick={() => onUpdateRepTarget?.({ id: 'custom', base: repTarget.base || 12, top: repTarget.top || 15 })} />
      </CheckList>

      {repTarget.id === 'custom' && (
        <div className="st-fields">
          {[{ key: 'base', label: 'من' }, { key: 'top', label: 'إلى' }].map(f => (
            <TextField key={f.key} label={f.label} numeric="int" unit="عدة"
              value={repTarget[f.key] ?? ''}
              onChange={e => onUpdateRepTarget?.({ [f.key]: parseInt(toWesternDigits(e.target.value)) || 0 })} />
          ))}
        </div>
      )}
    </>
  )
}
