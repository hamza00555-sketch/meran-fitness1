// ── Day Preview sheet ─────────────────────────────────────────
// Every exercise of a plan day: the picture, the Arabic name with the
// English under it, sets, the last and best weight, swap cycling
// (machine taken) and the form video — then start or skip.
//
// Drawn on the kit's one sheet (grabber, title, close, Escape, inert
// page behind, focus back to the opener). Its rows are open rows with
// hairlines, the start button the sheet's one green fill, docked in the
// footer so it never scrolls away.

import { Sheet, Button, Num, Weight } from './kit/index.jsx'
import { ArrowsLeftRight, Play, ArrowUp, SkipForward } from './kit/icons.js'
import { MUSCLE_GROUPS, EXERCISE_ALTERNATIVES } from '../constants.js'
import { substitutedName, nextSubIndex, getExerciseStats } from '../utils.js'
import { analyzeProgression, DEFAULT_REP_TARGET } from '../progression.js'
import { ExerciseThumb, exerciseNames } from './home/HomeBits.jsx'
import { dayWord, musclesLine, estimateMinutes, setsUnit } from './home/dayParts.js'
import { unitAr } from '../streak.js'

export function findVideoUrl(name) {
  for (const group of Object.values(MUSCLE_GROUPS)) {
    const ex = group.exercises?.find(e => e.name === name)
    if (ex?.videoUrl) return ex.videoUrl
  }
  return null
}

function PreviewRow({ ex, sessions, exerciseMapping, exerciseSubs, onCycleSub, repTarget }) {
  const shownName = substitutedName(ex.name, exerciseSubs, EXERCISE_ALTERNATIVES)
  const swapped   = shownName !== ex.name
  const alts      = EXERCISE_ALTERNATIVES[ex.name] || []
  const subIdx    = exerciseSubs[ex.name] || 0
  const videoUrl  = findVideoUrl(shownName)
  const { lastWeight, maxWeight } = getExerciseStats(sessions, shownName, exerciseMapping)
  const raise = analyzeProgression(sessions, shownName, exerciseMapping, repTarget).hint === 'raise'
  const { ar, en } = exerciseNames(shownName, exerciseMapping)
  const sets = Number(ex.sets) || 3
  const from = swapped ? exerciseNames(ex.name, exerciseMapping).ar : ''

  return (
    <li className="dp-row">
      <ExerciseThumb name={shownName} muscle={ex.muscle} size={48} />
      <div className="dp-main">
        <span className="dp-ar">{ar}</span>
        {en && <span className="dp-en" dir="ltr">{en}</span>}
        <span className="dp-meta">
          <span><Num>{sets}</Num> {setsUnit(sets)}</span>
          {lastWeight != null && (
            <span className="dp-last">
              · آخر مرة <Weight kg={lastWeight} />
              {raise && <ArrowUp size={14} weight="bold" className="hm-raise" aria-label="ارفع الوزن" />}
            </span>
          )}
          {maxWeight != null && lastWeight != null && maxWeight > lastWeight && (
            <span className="dp-best">· أعلى <Weight kg={maxWeight} /></span>
          )}
        </span>
        {swapped && <span className="dp-from">بدل {from}</span>}
      </div>
      <div className="dp-actions">
        {alts.length > 0 && (
          <button
            type="button"
            className={`dp-swap${swapped ? ' on' : ''}`}
            onClick={() => onCycleSub?.(ex.name, nextSubIndex(ex.name, exerciseSubs, EXERCISE_ALTERNATIVES))}
            aria-label={subIdx < alts.length ? `استبدال التمرين — التالي: ${alts[subIdx]}` : 'رجوع للتمرين الأصلي'}
            title={subIdx < alts.length ? `التالي: ${alts[subIdx]}` : 'رجوع للتمرين الأصلي'}
          >
            <ArrowsLeftRight size={18} weight="bold" aria-hidden="true" />
            {swapped ? <Num>{subIdx}/{alts.length}</Num> : <span>بدّل</span>}
          </button>
        )}
        {videoUrl && (
          <a className="dp-video" href={videoUrl} target="_blank" rel="noopener noreferrer"
            aria-label={`فيديو طريقة ${ar}`} title="فيديو الطريقة">
            <Play size={18} weight="fill" aria-hidden="true" />
          </a>
        )}
      </div>
    </li>
  )
}

export default function DayPreviewSheet({
  day, sessions = [], exerciseMapping = {}, exerciseSubs = {}, onCycleSub,
  onStart, onSkip, onClose, open = true, heading = 'تمارين اليوم',
  repTarget = DEFAULT_REP_TARGET,
}) {
  if (!day) return null
  const { word, variant, latin } = dayWord(day)
  const muscles = musclesLine(day)
  const mins = estimateMinutes(day)
  const n = day.exercises?.length || 0

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={heading}
      tall={n > 5}
      footer={(onStart || onSkip) ? (
        <div className="dp-foot">
          {onStart && <Button variant="primary" size="lg" full onClick={onStart}>ابدأ التمرين</Button>}
          {onSkip && (
            <Button variant="secondary" size="lg" onClick={onSkip} className="dp-skip"
              icon={(p) => <SkipForward {...p} mirrored />}>تخطي اليوم</Button>
          )}
        </div>
      ) : null}
    >
      <div className="dp-head">
        <span className={`dp-word${latin ? ' is-latin' : ''}`}>
          {word}{variant && <Num className="dp-variant">{variant}</Num>}
        </span>
        <span className="dp-sub">
          {muscles && <>{muscles} · </>}
          <Num>{n}</Num> {unitAr(n, 'workout')}
          {mins > 0 && <> · <Num>≈{mins}</Num> د</>}
        </span>
      </div>
      <ul className="dp-list">
        {(day.exercises || []).map((ex, i) => (
          <PreviewRow key={i} ex={ex} sessions={sessions} exerciseMapping={exerciseMapping}
            exerciseSubs={exerciseSubs} onCycleSub={onCycleSub} repTarget={repTarget} />
        ))}
      </ul>
    </Sheet>
  )
}
