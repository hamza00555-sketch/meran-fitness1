import { useState, useSyncExternalStore } from 'react'
import { subscribe, getVersion, urlFor, remoteUrlFor } from '../../assets/registry.js'
import { mediaSlotFor } from '../../exerciseMedia.js'

// ── A 48pt thumbnail for a library row ────────────────────────
//
// The exercise's own still when the art pack has it (installed, or
// streamable from the manifest), otherwise the muscle's art from
// public/assets, greyed and dimmed on an unlit tile so the fallback
// stays quiet (the tiles above already carry the lit art). Never an
// emoji, never a raster below 24pt (critique F39).

/** «/assets/muscle_chest.png» → the WebP copy (same folder, ~15× lighter). */
export const webp = (src) => (src ? src.replace(/\.png$/, '.webp') : src)

export default function Thumb({ name, art, mapping }) {
  useSyncExternalStore(subscribe, getVersion, getVersion)
  const [broken, setBroken] = useState(false)
  const [artBroken, setArtBroken] = useState(false)
  const slot = mediaSlotFor(name, mapping)
  const url = slot ? (urlFor(slot) || remoteUrlFor(slot)) : undefined

  if (url && !broken) {
    return (
      <span className="lib-thumb lib-thumb-still" aria-hidden="true">
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
      </span>
    )
  }
  return (
    <span className="lib-thumb lib-thumb-art" aria-hidden="true">
      {art && (
        <img src={artBroken ? art : webp(art)} alt="" loading="lazy" decoding="async"
          onError={() => { if (!artBroken) setArtBroken(true) }} />
      )}
    </span>
  )
}
