// ── <Art> ─────────────────────────────────────────────────────
// Draws a piece of downloaded artwork, or whatever the app already
// drew there before the pack existed.
//
//   <Art id="ach_c3" size={44} fallback={<span style={{fontSize:44}}>🔥🔥🔥</span>} />
//
// Two steps, not four: the pack image if it is installed, otherwise
// the fallback written in place. That keeps the app byte-identical
// to how it looks today until the pack lands, and it means every
// call site states its own fallback instead of relying on a
// central table that has to be kept in sync.
//
// It subscribes to the registry, so the moment a blob is verified
// mid-download the artwork appears — no reload.

import { useSyncExternalStore } from 'react'
import { subscribe, getVersion, urlFor, markBroken } from './registry.js'

export default function Art({ id, size, fallback = null, alt = '', title, className, style }) {
  useSyncExternalStore(subscribe, getVersion, getVersion)

  const url = urlFor(id)
  if (!url) return fallback

  return (
    <img
      src={url}
      alt={alt}
      title={title}
      data-art={id}
      className={className}
      onError={() => markBroken(id)}
      style={{
        display: 'inline-block', objectFit: 'contain',
        ...(size ? { width: size, height: size } : null),
        ...style,
      }}
    />
  )
}

/** True when this slot's artwork is installed — for call sites that need to branch. */
export function useHasArt(id) {
  useSyncExternalStore(subscribe, getVersion, getVersion)
  return !!urlFor(id)
}
