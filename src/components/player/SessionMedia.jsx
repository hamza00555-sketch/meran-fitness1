import { useState, useSyncExternalStore } from 'react'
import { subscribe, getVersion, urlFor, remoteUrlFor } from '../../assets/registry.js'
import { mediaSlotFor, animSlotFor } from '../../exerciseMedia.js'
import { MUSCLE_GROUPS } from '../../constants.js'
import { Barbell } from '../kit/icons.js'
import { useReveal } from '../kit/useReveal.js'

// ── The exercise's picture, for the stage and the thumbnail ──────
//
// The same ladder as assets/ExerciseMedia — local loop, local still,
// remote still, then the muscle art that ships with the app — but drawn
// for a lit stage instead of a 3:2 box: no box, no radius, the art
// standing on the neutral light. The last rung is a Phosphor barbell,
// never an emoji. Under reduced motion a loop never autoplays.
//
// Each rung comes in softly (kit/useReveal.js): a faint light while it is
// on its way, a 200ms fade when it arrives, nothing for one already here.

const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

export default function SessionMedia({ name, mapping = {}, muscle, animate = false, className }) {
  useSyncExternalStore(subscribe, getVersion, getVersion)
  const [videoBroken, setVideoBroken] = useState(false)
  const [stillBroken, setStillBroken] = useState(false)

  // Through the alias mapping, so a renamed machine keeps its art.
  const stillSlot = mediaSlotFor(name, mapping)
  const animSlot = animSlotFor(name, mapping)
  const stillUrl = stillSlot ? (urlFor(stillSlot) || remoteUrlFor(stillSlot)) : undefined
  const animUrl = animate && !videoBroken && animSlot && !reducedMotion() ? urlFor(animSlot) : undefined
  const group = MUSCLE_GROUPS[muscle]?.img
    ? MUSCLE_GROUPS[muscle]
    : Object.values(MUSCLE_GROUPS).find(g => g.exercises?.some(e => e.name === name))
  const still = stillUrl && !stillBroken ? stillUrl : null
  const reveal = useReveal(animUrl || still || group?.img || null)

  if (animUrl) {
    return (
      <video className={className} src={animUrl} autoPlay loop muted playsInline {...reveal}
        onError={() => setVideoBroken(true)} />
    )
  }
  if (still) {
    return <img className={className} src={still} alt="" loading="lazy" {...reveal} onError={() => setStillBroken(true)} />
  }
  if (group?.img) return <img className={className} src={group.img} alt="" data-art="muscle" {...reveal} />
  return <Barbell className={className} size={40} weight="regular" aria-hidden="true" />
}
