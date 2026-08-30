import { useState, useSyncExternalStore } from 'react'
import { subscribe, getVersion, urlFor, remoteUrlFor } from './registry.js'
import { mediaSlotFor, animSlotFor } from '../exerciseMedia.js'
import { MUSCLE_GROUPS } from '../constants.js'

// ── The exercise's picture, whatever is available ─────────────
//
// The display ladder, best first:
//
//   local loop animation  — pack installed, exercise has one, allowed
//   local still           — pack installed
//   remote still          — no pack, but the manifest is known: the
//                           image streams once and the service worker
//                           caches it (videos never stream — local only)
//   muscle-group art      — the ship-with-the-app PNG, always there
//
// Each rung only renders
// when the one above it is missing or fails, so a corrupt video decays
// into a picture, never into a broken player.
//
// `animate` is a gate, not a wish: the player passes true only for the
// slide actually on screen (and its neighbours warm up as stills), so
// an installed pack of twenty videos never means twenty playing videos.

export default function ExerciseMedia({ name, animate = false, style }) {
  useSyncExternalStore(subscribe, getVersion, getVersion)
  const [videoBroken, setVideoBroken] = useState(false)
  const [stillBroken, setStillBroken] = useState(false)

  const stillSlot = mediaSlotFor(name)
  const animSlot = animSlotFor(name)
  const stillUrl = stillSlot ? (urlFor(stillSlot) || remoteUrlFor(stillSlot)) : undefined
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

  if (stillUrl && !stillBroken) {
    return (
      <div style={box}>
        <img
          src={stillUrl} alt="" loading="lazy"
          onError={() => setStillBroken(true)}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
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
