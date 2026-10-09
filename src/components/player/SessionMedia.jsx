import { useState, useSyncExternalStore } from 'react'
import { subscribe, getVersion, urlFor, remoteUrlFor } from '../../assets/registry.js'
import { mediaSlotFor, animSlotFor } from '../../exerciseMedia.js'
import { MUSCLE_GROUPS } from '../../constants.js'
import { Barbell } from '../kit/icons.js'

// ── The exercise's picture, for the stage and the thumbnail ──────
//
// The same ladder as assets/ExerciseMedia — local loop, local still,
// remote still, then the muscle art that ships with the app — but drawn
// for a lit stage instead of a 3:2 box: no box, no radius, the art
// standing on the neutral light. The last rung is a Phosphor barbell,
// never an emoji. Under reduced motion a loop never autoplays.

const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

export default function SessionMedia({ name, muscle, animate = false, className }) {
  useSyncExternalStore(subscribe, getVersion, getVersion)
  const [videoBroken, setVideoBroken] = useState(false)
  const [stillBroken, setStillBroken] = useState(false)

  const stillSlot = mediaSlotFor(name)
  const animSlot = animSlotFor(name)
  const stillUrl = stillSlot ? (urlFor(stillSlot) || remoteUrlFor(stillSlot)) : undefined
  const animUrl = animate && !videoBroken && animSlot && !reducedMotion() ? urlFor(animSlot) : undefined

  if (animUrl) {
    return (
      <video className={className} src={animUrl} autoPlay loop muted playsInline
        onError={() => setVideoBroken(true)} />
    )
  }
  if (stillUrl && !stillBroken) {
    return <img className={className} src={stillUrl} alt="" loading="lazy" onError={() => setStillBroken(true)} />
  }
  const group = MUSCLE_GROUPS[muscle]?.img
    ? MUSCLE_GROUPS[muscle]
    : Object.values(MUSCLE_GROUPS).find(g => g.exercises?.some(e => e.name === name))
  if (group?.img) return <img className={className} src={group.img} alt="" data-art="muscle" />
  return <Barbell className={className} size={40} weight="regular" aria-hidden="true" />
}
