import { useCallback, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { YoutubeLogo, ArrowSquareOut } from '@phosphor-icons/react'
import { Sheet, IconButton, Chip, Num, Stage } from './kit/index.jsx'
import { X, Play } from './kit/icons.js'
import { subscribe, getVersion, urlFor, remoteUrlFor } from '../assets/registry.js'
import Sparkline from './library/Sparkline.jsx'
import { webp } from './library/Thumb.jsx'
import { buildProgress, recordFor, summarize, countWord, fmtKg, SESSION_WORDS } from './library/progress.js'
import { MUSCLE_GROUPS, DEFAULT_EXERCISE_MAPPING } from '../constants.js'
import { EXERCISE_MEDIA, arabicName, equipLabel, mediaSlotFor, animSlotFor } from '../exerciseMedia.js'
import { ls, resolveExerciseName } from '../utils.js'
import '../styles/screens/library.css'

// ── The exercise, explained ───────────────────────────────────
//
// A kit sheet (critique F61, modal-exercise-info):
//
//   · the media on a lit stage, edge to edge — the art pack's loop when
//     it is installed (47 lifts have one), its still otherwise, the
//     muscle's own art as the last resort. The old sheet read a field
//     nobody defined and promised «قادماً» for loops that already ship.
//   · the Arabic name, the English one under it in the Latin face, the
//     muscle and the equipment as neutral chips
//   · «نقاط الأداء»: the cues, numbered in a neutral colour
//   · «سجلك»: last time, the best weight (gold — the one gold here), how
//     many sessions, and the trend of the estimated one-rep max (deload
//     sessions left out of it: they are light on purpose)
//   · YouTube as one quiet last row, no red
//
// Opened from the library, the player and the old exercise card, with
// the same props as before. `sessions` and `mapping` are optional: when
// a caller does not pass them, the sheet reads what is saved (read-only)
// so «سجلك» is never empty by accident.

const CATALOGUE = Object.entries(MUSCLE_GROUPS).flatMap(([key, g]) =>
  (g.exercises || []).map(def => ({ key, def })))

function lookup(name, mapping) {
  if (!name) return null
  const exact = CATALOGUE.find(c => c.def.name === name)
  if (exact) return exact
  const want = resolveExerciseName(name, mapping)
  return CATALOGUE.find(c => c.def.name.toLowerCase() === want) || null
}

export default function ExerciseInfoModal({ exercise, onClose, sessions, mapping }) {
  const [open, setOpen] = useState(true)
  const titleId = useId()
  const close = useCallback(() => {
    setOpen(false)
    // Let the sheet play its exit before the caller unmounts it.
    setTimeout(() => onClose?.(), 220)
  }, [onClose])

  const map = useMemo(
    () => mapping ?? { ...DEFAULT_EXERCISE_MAPPING, ...ls.get('hf_exercise_mapping', {}) },
    [mapping])
  const history = useMemo(() => sessions ?? ls.get('hf_sessions', []), [sessions])

  const hit = lookup(exercise?.name, map)
  const name = hit?.def.name || exercise?.name || ''
  const muscleKey = exercise?.muscle && MUSCLE_GROUPS[exercise.muscle] ? exercise.muscle : hit?.key
  const group = MUSCLE_GROUPS[muscleKey] || null
  const def = hit?.def || {}
  const ar = arabicName(name, map)
  const equip = equipLabel(name, map)
  const tips = def.tips || exercise?.tips || []
  const videoUrl = def.videoUrl || exercise?.videoUrl ||
    `https://www.youtube.com/results?search_query=${encodeURIComponent(name + ' proper form')}`

  const record = useMemo(() => {
    const progress = buildProgress(history, map)
    return summarize(recordFor(progress, exercise?.name || name, map) || recordFor(progress, name, map))
  }, [history, map, exercise?.name, name])

  // Done, but never with a weight (pull-ups, planks): say so, rather
  // than claiming it was never logged.
  const bodyweightOnly = useMemo(() => {
    if (record) return false
    const want = new Set([resolveExerciseName(name, map), resolveExerciseName(exercise?.name || name, map)])
    return (history || []).some(s => (s.exercises || []).some(ex =>
      want.has(resolveExerciseName(ex.name, map)) &&
      (ex.sets || []).some(st => (parseInt(st.reps) || 0) > 0) &&
      !(ex.sets || []).some(st => parseFloat(st.weight) > 0)))
  }, [record, history, map, name, exercise?.name])

  const media = useStageMedia(EXERCISE_MEDIA[name] ? name : (exercise?.name || name))

  const nameBlock = (
    <header className={media.kind === 'art' ? 'xi-name xi-name-on' : 'xi-name'}>
      <h2 id={titleId} className="xi-title">{ar || name}</h2>
      {ar && <p className="xi-en"><bdi dir="ltr">{name}</bdi></p>}
      {(group || equip) && (
        <div className="xi-chips">
          {group && <Chip>{group.label}</Chip>}
          {equip && <Chip>{equip}</Chip>}
        </div>
      )}
    </header>
  )

  return (
    <Sheet open={open} onClose={close} labelledBy={titleId}>
      {/* Pinned: a zero-height sticky bar, so the X floats over the media
          at first and stays in reach while the body scrolls to «سجلك». */}
      <div className="xi-closebar">
        <IconButton icon={X} label="إغلاق" variant="filled" weight="bold" className="xi-close" onClick={close} />
      </div>
      <div className="xi">
        <div className="xi-stagebox">
          {media.kind === 'art'
            ? (
              // No pack picture: the muscle's art on a lit stage, past the
              // end edge, with the name in the dark third (Floodlight).
              <Stage className="xi-stage-art" art={webp(group?.img)} height={208}>
                {nameBlock}
              </Stage>
            )
            : <MediaStage media={media} />}
        </div>

        {media.kind !== 'art' && nameBlock}

        {tips.length > 0 && (
          <section className="xi-sec" aria-labelledby={titleId + '-cues'}>
            <h3 id={titleId + '-cues'} className="xi-h">نقاط الأداء</h3>
            <ol className="xi-cues">
              {tips.map((tip, i) => (
                <li key={i}>
                  <span className="xi-cue-n" aria-hidden="true"><Num>{i + 1}</Num></span>
                  <span className="xi-cue-t">{tip}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="xi-sec" aria-labelledby={titleId + '-rec'}>
          <h3 id={titleId + '-rec'} className="xi-h">سجلك</h3>
          {record ? <Record r={record} /> : (
            <p className="xi-none">
              {bodyweightOnly
                ? 'سجّلته بوزن جسمك، فما فيه وزن نرسم له خط. أول ما تضيف وزن يطلع سجلك هنا.'
                : 'ما سجّلت هذا التمرين للحين. أول جلسة تسجّله فيها يطلع سجلك هنا.'}
            </p>
          )}
        </section>

        <a className="xi-yt" href={videoUrl} target="_blank" rel="noopener noreferrer">
          <YoutubeLogo size={20} weight="regular" aria-hidden="true" />
          <span>فيديوهات شرح على يوتيوب</span>
          <ArrowSquareOut size={16} weight="bold" mirrored className="xi-yt-out" aria-hidden="true" />
        </a>
      </div>
    </Sheet>
  )
}

// ── The media ladder ──────────────────────────────────────────
// The same order as the player's hero (assets/ExerciseMedia.jsx): the
// pack's loop (local only, videos never stream), the pack's still
// (local, or streamed once from the manifest), and only then the
// muscle's art. Each rung falls through on error, so a corrupt video
// becomes a picture, never a broken frame.
function useStageMedia(name) {
  useSyncExternalStore(subscribe, getVersion, getVersion)
  const [videoBroken, setVideoBroken] = useState(false)
  const [stillBroken, setStillBroken] = useState(false)
  const stillSlot = mediaSlotFor(name)
  const animSlot = animSlotFor(name)
  const still = stillSlot ? (urlFor(stillSlot) || remoteUrlFor(stillSlot)) : undefined
  const anim = !videoBroken && animSlot ? urlFor(animSlot) : undefined
  if (anim) return { kind: 'video', src: anim, poster: stillBroken ? undefined : still, onError: () => setVideoBroken(true) }
  if (still && !stillBroken) return { kind: 'still', src: still, onError: () => setStillBroken(true) }
  return { kind: 'art' }
}

const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

function MediaStage({ media }) {
  // With reduced motion the loop waits for a tap instead of autoplaying.
  const [reduce] = useState(prefersReducedMotion)
  const [playing, setPlaying] = useState(!reduce)
  const video = useRef(null)
  return (
    <div className="xi-stage">
      {media.kind === 'video'
        ? (
          <video ref={video} key={media.src} className="xi-media" src={media.src} poster={media.poster}
            autoPlay={!reduce} loop muted playsInline onError={media.onError}
            onPlay={() => setPlaying(true)} aria-label="الحركة" />
        )
        : <img className="xi-media" src={media.src} alt="" onError={media.onError} />}
      {media.kind === 'video' && !playing && (
        <IconButton icon={Play} label="شغّل الحركة" variant="filled" size={56} weight="fill"
          className="xi-play" onClick={() => { video.current?.play?.(); setPlaying(true) }} />
      )}
    </div>
  )
}

function Record({ r }) {
  const trend = r.trend.slice(-12)
  const tw = countWord(trend.length, SESSION_WORDS)
  return (
    <>
      <dl className="xi-stats">
        <div className="xi-stat">
          <dt>آخر مرة</dt>
          <dd className="xi-stat-v"><Num>{fmtKg(r.last.maxW)}</Num><span className="xi-unit"> كجم</span></dd>
          {(r.last.reps > 0 || r.lastDeload) && (
            <dd className="xi-stat-c">
              {r.last.reps > 0 && <><Num>{r.last.reps}</Num> تكرار</>}
              {r.last.reps > 0 && r.lastDeload && ' · '}
              {r.lastDeload && 'ديلود'}
            </dd>
          )}
        </div>
        <div className="xi-stat">
          <dt>أعلى وزن</dt>
          <dd className="xi-stat-v xi-best"><Num>{fmtKg(r.best)}</Num><span className="xi-unit"> كجم</span></dd>
        </div>
        <div className="xi-stat">
          <dt>الجلسات</dt>
          <dd className="xi-stat-v"><Num>{r.sessions}</Num></dd>
        </div>
      </dl>
      {trend.length > 1 && (
        <div className="xi-trend">
          <div className="xi-trend-h">
            <span className="xi-trend-l">التقدير</span>
            <span className="xi-trend-v"><Num>{r.e1rm}</Num><span className="xi-unit"> كجم</span></span>
          </div>
          <Sparkline fluid height={56} values={trend} className="xi-spark"
            label={`التقدير في ${trend.length} جلسات: من ${Math.round(trend[0])} إلى ${r.e1rm} كجم`} />
          <p className="xi-cap">
            {tw.n != null ? <>آخر <Num>{tw.n}</Num> {tw.word}</> : <>آخر {tw.word}</>}
            {' · '}تقدير لأقصى وزن تشيله مرة وحدة، والأحدث على اليسار
            {r.deloads > 0 && r.deloads < r.sessions && '. جلسات الديلود خفيفة بقصد، فما تدخل فيه'}
          </p>
        </div>
      )}
    </>
  )
}
