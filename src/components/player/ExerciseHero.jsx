import { useRef, useState } from 'react'
import { IconButton, ListGroup, ListRow, Sheet, Num } from '../kit/index.jsx'
import {
  DotsThree, Info, ArrowsLeftRight, Plus, Minus, Copy, Check, Trash, Play, X, CaretUp,
} from '../kit/icons.js'
import { ArrowBendDownLeft } from '@phosphor-icons/react'
import SessionMedia from './SessionMedia.jsx'
import ExerciseTags from './ExerciseTags.jsx'
import { arabicName } from '../../exerciseMedia.js'
import { MUSCLE_GROUPS } from '../../constants.js'

// ── The exercise, presented like a broadcast name strap ───────
//
// Before the first set: a lit stage, edge to edge (max ~30% of the
// screen), the exercise's media standing on neutral light at the end
// side, and over its dark lower third the Arabic name at 22/700 above
// the English at 15/600 in the Latin face — the way a sports broadcast
// straps a player's name. Once a set is logged the stage folds into a
// 72pt row (thumbnail, names, ⋯) and the numbers own the screen. The
// thumbnail brings the stage back for a look. The muscle art appears
// once, never twice.
//
// A horizontal swipe on the head moves to the neighbouring exercise —
// the carousel's one job, without its clipped neighbour card.
//
// Everything that isn't set-logging lives behind ⋯: info, video, swap,
// add/remove a set, move a set, copy the name, remove the exercise —
// and, in its own group, the session's «إلغاء التمرين».

function useSwipe(onSwipe) {
  const start = useRef(null)
  return {
    onPointerDown: (e) => { start.current = { x: e.clientX, y: e.clientY } },
    onPointerUp: (e) => {
      const s = start.current
      start.current = null
      if (!s || !onSwipe) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      // RTL: the next exercise waits on the left, so dragging right brings it.
      if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx > 0 ? 1 : -1)
    },
    onPointerCancel: () => { start.current = null },
  }
}

export default function ExerciseHero({
  ex, expanded, animate = false, onToggleStage, collapsible = false,
  maxWeight = null, deloadPct = 0, quietBest = false, ytUrl,
  canSwap, swapTitle, onSwap, onRemove, onAddSet, onRemoveSet, onMoveSet, moveTargets = [],
  onAddExercise, onDiscard, onSwipe,
}) {
  const [menu, setMenu] = useState(false)
  const [info, setInfo] = useState(false)
  const [copied, setCopied] = useState(false)
  const swipe = useSwipe(onSwipe)

  const ar = arabicName(ex.name)
  const primary = ar || ex.name
  const secondary = ar ? ex.name : null

  const act = (fn) => () => { setMenu(false); fn?.() }

  const names = (
    <div className="s-strap-names">
      <h2 className="s-name-ar" data-testid="exercise-name">{primary}</h2>
      {secondary && <p className="s-name-en" dir="ltr">{secondary}</p>}
    </div>
  )
  const more = (
    <IconButton icon={DotsThree} label="خيارات التمرين" weight="bold" iconSize={26}
      className="s-more" onClick={() => setMenu(true)} />
  )

  return (
    <>
      {expanded ? (
        <section className="s-stage" data-testid="exercise-stage" {...swipe}>
          {collapsible && (
            <IconButton icon={CaretUp} label="أخفِ الصورة" weight="bold" className="s-stage-fold"
              onClick={onToggleStage} />
          )}
          <div className="s-stage-media">
            <SessionMedia key={ex.name} name={ex.name} muscle={ex.muscle} animate={animate} className="s-stage-img" />
          </div>
          <div className="s-strap">
            <div className="s-strap-row">{names}{more}</div>
            <ExerciseTags ex={ex} maxWeight={maxWeight} deloadPct={deloadPct} quietBest={quietBest} />
          </div>
        </section>
      ) : (
        <section className="s-exrow" data-testid="exercise-row" {...swipe}>
          <button type="button" className="s-thumb" onClick={onToggleStage} aria-label="اعرض صورة التمرين">
            <SessionMedia key={ex.name} name={ex.name} muscle={ex.muscle} className="s-thumb-img" />
          </button>
          {names}
          {more}
        </section>
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} title={primary}>
        <ListGroup header="هذا التمرين">
          <ListRow leading={Info} title="معلومات ونصائح" onClick={act(() => setInfo(true))} />
          {ytUrl && (
            <ListRow leading={Play} title="شاهد الأداء الصحيح" subtitle="يفتح يوتيوب"
              onClick={act(() => window.open(ytUrl, '_blank', 'noopener,noreferrer'))} />
          )}
          {canSwap && (
            <ListRow leading={ArrowsLeftRight} title="استبدال التمرين"
              subtitle={swapTitle ? <bdi>{swapTitle}</bdi> : 'الجهاز مشغول؟ جرّب البديل'}
              onClick={act(onSwap)} />
          )}
          <ListRow leading={Plus} title="إضافة مجموعة" onClick={act(onAddSet)} />
          {ex.sets.length > 1 && (
            <ListRow leading={Minus} title="حذف آخر مجموعة" onClick={act(onRemoveSet)} />
          )}
          <ListRow leading={copied ? Check : Copy} title={copied ? 'نُسخ الاسم' : 'نسخ الاسم'}
            onClick={() => {
              navigator.clipboard?.writeText(ex.name).then(() => setCopied(true)).catch(() => {})
              setTimeout(() => { setCopied(false); setMenu(false) }, 700)
            }} />
          <ListRow leading={Trash} title="إزالة التمرين من الجلسة" tone="danger" onClick={act(onRemove)} />
        </ListGroup>

        {moveTargets.length > 0 && ex.sets.length > 0 && (
          <ListGroup header="نقل آخر مجموعة إلى">
            {moveTargets.map(t => (
              <ListRow key={t.id} leading={ArrowBendDownLeft}
                title={arabicName(t.name) || t.name}
                subtitle={arabicName(t.name) ? <bdi dir="ltr">{t.name}</bdi> : null}
                onClick={act(() => onMoveSet(t.id))} />
            ))}
          </ListGroup>
        )}

        <ListGroup header="الجلسة">
          {onAddExercise && <ListRow leading={Plus} title="إضافة تمرين" onClick={act(onAddExercise)} />}
          {onDiscard && (
            <ListRow leading={X} title="إلغاء التمرين" subtitle="تنحذف الجلسة كاملة بدون حفظ"
              tone="danger" onClick={act(onDiscard)} />
          )}
        </ListGroup>
      </Sheet>

      <ExerciseInfoSheet open={info} ex={ex} ytUrl={ytUrl} onClose={() => setInfo(false)} />
    </>
  )
}

// The exercise's tips and video, as a sheet. (The old info modal is a
// portal under the session cover, so it opened invisibly here.)
function ExerciseInfoSheet({ open, ex, ytUrl, onClose }) {
  const group = MUSCLE_GROUPS[ex.muscle] || {}
  const def = (group.exercises || []).find(e => e.name === ex.name)
    || Object.values(MUSCLE_GROUPS).flatMap(g => g.exercises || []).find(e => e.name === ex.name)
    || {}
  const ar = arabicName(ex.name)
  return (
    <Sheet open={open} onClose={onClose} title={ar || ex.name}>
      {ar && <p className="s-info-en" dir="ltr">{ex.name}</p>}
      {def.tips?.length > 0 && (
        <ListGroup header="نصائح">
          {def.tips.map((tip, i) => (
            <ListRow key={i} leading={<span className="s-info-n"><Num>{i + 1}</Num></span>} title={<span className="s-info-tip">{tip}</span>} />
          ))}
        </ListGroup>
      )}
      <ListGroup>
        {group.label && <ListRow leading={Info} title="العضلة" trailing={group.label} />}
        {ytUrl && (
          <ListRow leading={Play} title="شاهد الأداء الصحيح" subtitle="يفتح يوتيوب" chevron
            onClick={() => window.open(ytUrl, '_blank', 'noopener,noreferrer')} />
        )}
      </ListGroup>
    </Sheet>
  )
}
