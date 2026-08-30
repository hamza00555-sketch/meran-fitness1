import { useState, useSyncExternalStore } from 'react'
import { subscribe, getVersion, urlFor } from './registry.js'
import { mediaSlotFor, animSlotFor } from '../exerciseMedia.js'
import { MUSCLE_GROUPS } from '../constants.js'

// ── The exercise's picture, whatever is available ─────────────
//
// The display ladder, best first:
//
//   local loop animation  — pack installed, exercise has one, allowed
//   local still           — pack installed
//   muscle-group art      — the ship-with-the-app PNG, always there
//
// Remote stills join the ladder in the pack-integration phase; the
// component is the one place that will change. Each rung only renders
// when the one above it is missing or fails, so a corrupt video decays
// into a picture, never into a broken player.
//
// `animate` is a gate, not a wish: the player passes true only for the
// slide actually on screen (and its neighbours warm up as stills), so
// an installed pack of twenty videos never means twenty playing videos.

export default function ExerciseMedia({ name, animate = false, style }) {
  useSyncExternalStore(subscribe, getVersion, getVersion)
  const [videoBroken, setVideoBroken] = useState(false)

  const stillSlot = mediaSlotFor(name)
  const animSlot = animSlotFor(name)
  const stillUrl = stillSlot ? urlFor(stillSlot) : undefined
  const animUrl = animate && !videoBroken && animSlot ? urlFor(animSlot) : undefined

  const box = {
    width: '100%', aspectRatio: '3 / 2', borderRadius: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg3)', overflow: 'hidden',
    ...style,
  }

  if (animUrl) {
    return (
      <div style={box}>
        <video
          src={animUrl}
          autoPlay loop muted playsInline
          onError={() => setVideoBroken(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    )
  }

  if (stillUrl) {
    return (
      <div style={box}>
        <img src={stillUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
    )
  }

  // The fallback everyone has: the muscle group's own artwork, small
  // and centred rather than stretched into a fake hero.
  const group = Object.values(MUSCLE_GROUPS).find(g => g.exercises?.some(e => e.name === name))
  return (
    <div style={box}>
      {group?.img
        ? <img src={group.img} alt="" style={{ height: '78%', objectFit: 'contain', opacity: 0.9 }} />
        : <span style={{ fontSize: 44 }}>{group?.emoji || '🏋️'}</span>}
    </div>
  )
}
