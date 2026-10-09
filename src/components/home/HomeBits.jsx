// ── Small pieces Home and its sheets share ────────────────────
//
//   withNums(text)   — every digit run in an Arabic sentence isolated LTR
//                      and tabular (<Num>), so «باقي 9 س 40 د» and «+1»
//                      never print backwards or in the Arabic face.
//   ExerciseThumb    — a 40pt picture of the exercise: the pack's still if
//                      it is installed on this phone, otherwise the
//                      muscle group's shipped artwork. Never the network,
//                      never an emoji.
//   exerciseNames    — Arabic first, the English name second.

import { useState, useSyncExternalStore } from 'react'
import { Num } from '../kit/index.jsx'
import { subscribe, getVersion, urlFor } from '../../assets/registry.js'
import { mediaSlotFor, arabicName } from '../../exerciseMedia.js'
import { MUSCLE_GROUPS } from '../../constants.js'

const DIGITS = /([+−-]?\d+(?:[.,:/]\d+)*%?)/

/** Wrap each number in a string with <Num>. Strings only; anything else
 *  passes through untouched. */
export function withNums(text) {
  if (typeof text !== 'string' || !/\d/.test(text)) return text
  return text.split(DIGITS).map((part, i) =>
    i % 2 ? <Num key={i}>{part}</Num> : part)
}

const groupOf = (name, muscle) =>
  MUSCLE_GROUPS[muscle] ||
  Object.values(MUSCLE_GROUPS).find(g => g.exercises?.some(e => e.name === name)) ||
  null

export function ExerciseThumb({ name, muscle, size = 40, className = '' }) {
  useSyncExternalStore(subscribe, getVersion, getVersion)
  const [broken, setBroken] = useState(false)
  const slot = mediaSlotFor(name)
  const still = slot && !broken ? urlFor(slot) : undefined
  const fallback = groupOf(name, muscle)?.img
  const style = { width: size, height: size }
  return (
    <span className={`hm-thumb${still ? ' is-still' : ''} ${className}`} style={style} aria-hidden="true">
      {still
        ? <img src={still} alt="" loading="lazy" onError={() => setBroken(true)} />
        : fallback ? <img src={fallback} alt="" loading="lazy" /> : null}
    </span>
  )
}

/** { ar, en } — the Arabic display name when the catalogue has one; the
 *  stored (English) name otherwise, which then has no second line. */
export function exerciseNames(name, mapping = {}) {
  const ar = arabicName(name, mapping)
  return ar ? { ar, en: name } : { ar: name, en: '' }
}
