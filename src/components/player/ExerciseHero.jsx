import { useRef, useState } from 'react'
import { IconButton, ListGroup, ListRow, Sheet, Num } from '../kit/index.jsx'
import {
  DotsThree, Info, ArrowsLeftRight, Plus, Minus, Copy, Check, Trash, X, CaretUp, YoutubeLogo,
} from '../kit/icons.js'
import { ArrowBendDownLeft } from '@phosphor-icons/react'
import SessionMedia from './SessionMedia.jsx'
import ExerciseTags from './ExerciseTags.jsx'
import { arabicName } from '../../exerciseMedia.js'
import { MUSCLE_GROUPS } from '../../constants.js'
import { resolveExerciseName } from '../../utils.js'

// ── The exercise, presented like a broadcast name strap ───────
//
// Before the first set: a lit stage, edge to edge (max ~30% of the
// screen), the exercise's media standing on neutral light at the end
// side, and over its dark lower third the Arabic name at 22/700 above
// the English at 15/600 in the Latin face — the way a sports broadcast
// straps a player's name. Once a set is logged the stage folds into a
// 72pt row (thumbnail, names, ▶, ⋯) and the numbers own the screen. The
// thumbnail brings the stage back for a look. The muscle art appears
// once, never twice.
//
// The demo video is the one tool that stays in sight. On the stage it is
// the broadcast's corner bug: a small frosted pill — the YouTube mark and
// «شوف الطريقة» — in the empty top start corner (the art's head fills
// the other one), clear of the strap. It stays put: when the stage is
// reopened from the thumbnail, «أخفِ الصورة» takes the opposite corner
// rather than pushing the pill along. On the 72pt row it is the same
// filled mark on the same glass, as a disc, 12pt clear of ⋯ so a thumb
// meant for swap/remove doesn't leave for YouTube. Monochrome in both
// places: colour is state, and YouTube's red is not one of ours.
//
// A horizontal swipe on the head moves to the neighbouring exercise —
// the carousel's one job, without its clipped neighbour card. A swipe
// that happens to start on the pill (or the chevron) still swipes, and
// opens nothing.
//
// Everything else that isn't set-logging lives behind ⋯: info, swap,
// add/remove a set, move a set, copy the name, remove the exercise —
// and, in its own group, the session's «إلغاء التمرين».
//
// Every name here goes through the user's alias mapping, so a machine he
// renamed (or a custom alias) still finds its Arabic name and its art.

const openVideo = (url) => { if (url) window.open(url, '_blank', 'noopener,noreferrer') }

/**
 * A control that sits on the swipeable head: a tap activates it, a drag
 * that started on it is the head's swipe and does nothing here. The
 * pointer events still bubble, so the swipe sees the whole gesture.
 *
 * The gesture is forgotten when it ends (pointerup, pointercancel), so
 * nothing stale outlives it: a click is ignored only when it lands right
 * after a gesture that moved — the click a mouse drag inside the control
 * produces. A keyboard or switch press is a click with no pointer behind
 * it (detail 0) and always activates.
 */
const SWIPE_CLICK_MS = 500
function useTap(onTap) {
  const press = useRef(null)     // { x, y, moved } while a pointer is down
  const swipedAt = useRef(0)     // when a gesture that moved ended
  const end = (moved) => {
    press.current = null
    swipedAt.current = moved ? performance.now() : 0
  }
  return {
    onPointerDown: (e) => {
      press.current = { x: e.clientX, y: e.clientY, moved: false }
      swipedAt.current = 0
    },
    onPointerMove: (e) => {
      const p = press.current
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) p.moved = true
    },
    onPointerUp: () => end(!!press.current?.moved),
    onPointerCancel: () => end(false),
    onClick: (e) => {
      const swiped = e.detail > 0 && performance.now() - swipedAt.current < SWIPE_CLICK_MS
      swipedAt.current = 0
      if (!swiped) onTap()
    },
  }
}

/** The YouTube mark, filled, in ink — the same glyph on the stage and on the row. */
const WatchMark = () => <YoutubeLogo size={20} weight="fill" aria-hidden="true" />

/** Arabic first, the English after it in the Latin face; English alone when there is no Arabic. */
function NameAr({ name, mapping }) {
  const ar = arabicName(name, mapping)
  if (!ar) return <bdi dir="ltr" className="s-latin">{name}</bdi>
  return <>{ar}<span className="s-latin-sep" aria-hidden="true">·</span><bdi dir="ltr" className="s-latin">{name}</bdi></>
}

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
  ex, mapping = {}, expanded, animate = false, onToggleStage, collapsible = false,
  maxWeight = null, deloadPct = 0, quietBest = false, ytUrl,
  canSwap, swapNext = null, swapOrigin = null, onSwap, onRemove, onAddSet, onRemoveSet, onMoveSet, moveTargets = [],
  onAddExercise, onDiscard, onSwipe,
}) {
  const [menu, setMenu] = useState(false)
  const [info, setInfo] = useState(false)
  const [copied, setCopied] = useState(false)
  const swipe = useSwipe(onSwipe)
  const watch = useTap(() => openVideo(ytUrl))
  const fold = useTap(() => onToggleStage?.())

  const ar = arabicName(ex.name, mapping)
  const primary = ar || ex.name
  const secondary = ar ? ex.name : null
  // An English-only name is an LTR paragraph: in the RTL heading its lines
  // and its clamp ellipsis would land in the wrong order («…ncline Close-»).
  const latinOnly = !ar && !/[؀-ۿ]/.test(primary)

  const act = (fn) => () => { setMenu(false); fn?.() }

  const names = (
    <div className="s-strap-names">
      <h2 className="s-name-ar" data-testid="exercise-name" dir={latinOnly ? 'ltr' : undefined}>{primary}</h2>
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
          {ytUrl && (
            <button type="button" className="s-glass-btn s-watch-stage" data-testid="watch-video"
              aria-label="شوف الطريقة على يوتيوب" {...watch}>
              <span className="s-glass s-watch-pill">
                <WatchMark />
                شوف الطريقة
              </span>
            </button>
          )}
          {collapsible && (
            <button type="button" className="s-glass-btn s-stage-fold" data-testid="stage-fold"
              aria-label="أخفِ الصورة" title="أخفِ الصورة" {...fold}>
              <span className="s-glass s-disc">
                <CaretUp size={18} weight="bold" aria-hidden="true" />
              </span>
            </button>
          )}
          <div className="s-stage-media">
            <SessionMedia key={ex.name} name={ex.name} mapping={mapping} muscle={ex.muscle} animate={animate} className="s-stage-img" />
          </div>
          <div className="s-strap">
            <div className="s-strap-row">{names}{more}</div>
            <ExerciseTags ex={ex} mapping={mapping} maxWeight={maxWeight} deloadPct={deloadPct} quietBest={quietBest} />
          </div>
        </section>
      ) : (
        <section className="s-exrow" data-testid="exercise-row" {...swipe}>
          <button type="button" className="s-thumb" onClick={onToggleStage} aria-label="اعرض صورة التمرين">
            <SessionMedia key={ex.name} name={ex.name} mapping={mapping} muscle={ex.muscle} className="s-thumb-img" />
          </button>
          {names}
          {ytUrl && (
            <button type="button" className="s-glass-btn s-watch-row" data-testid="watch-video"
              aria-label="شوف الطريقة على يوتيوب" title="شوف الطريقة" {...watch}>
              <span className="s-glass s-disc"><WatchMark /></span>
            </button>
          )}
          {more}
        </section>
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} title={primary}>
        <ListGroup header="هذا التمرين">
          <ListRow leading={Info} title="معلومات ونصائح" onClick={act(() => setInfo(true))} />
          {canSwap && (
            <ListRow leading={ArrowsLeftRight} title="استبدال التمرين"
              subtitle={swapNext
                ? <>التالي: <NameAr name={swapNext} mapping={mapping} /></>
                : swapOrigin && swapOrigin !== ex.name
                  ? <>رجوع إلى <NameAr name={swapOrigin} mapping={mapping} /></>
                  : 'الجهاز مشغول؟ جرّب البديل'}
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
                title={arabicName(t.name, mapping) || t.name}
                subtitle={arabicName(t.name, mapping) ? <bdi dir="ltr" className="s-latin">{t.name}</bdi> : null}
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

      <ExerciseInfoSheet open={info} ex={ex} mapping={mapping} ytUrl={ytUrl} onClose={() => setInfo(false)} />
    </>
  )
}

// The exercise's tips and video, as a sheet. (The old info modal is a
// portal under the session cover, so it opened invisibly here.)
function ExerciseInfoSheet({ open, ex, mapping = {}, ytUrl, onClose }) {
  const group = MUSCLE_GROUPS[ex.muscle] || {}
  const canon = resolveExerciseName(ex.name, mapping)
  const all = Object.values(MUSCLE_GROUPS).flatMap(g => g.exercises || [])
  const def = (group.exercises || []).find(e => e.name === ex.name)
    || all.find(e => e.name === ex.name)
    || all.find(e => e.name.toLowerCase() === canon)
    || {}
  const ar = arabicName(ex.name, mapping)
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
          <ListRow leading={YoutubeLogo} title="شوف الطريقة" subtitle="يفتح يوتيوب" chevron
            onClick={() => openVideo(ytUrl)} />
        )}
      </ListGroup>
    </Sheet>
  )
}
