// ── <Ico> ─────────────────────────────────────────────────────
// The single place an icon is drawn. Four steps, first hit wins:
//
//   1. the downloaded asset   (object URL from the registry)
//   2. a bundled inline SVG   (always available, no network)
//   3. the emoji              (last resort — never seen once the
//                              pack is installed)
//   4. nothing                (an id with no art is drawn as a gap,
//                              not a broken-image glyph, so a
//                              manifest can withdraw art safely)
//
// It subscribes to the registry, so the moment a blob is verified
// mid-download every <Ico> for that id becomes an image. That is
// the whole of "no restart".

import { useSyncExternalStore } from 'react'
import { subscribe, getVersion, urlFor, idForEmoji, markBroken } from './registry.js'
import { FALLBACK_SVG } from './fallback.js'
import { emojiFor } from './ids.js'

// A raster inside a line of Arabic text sits slightly low on the
// baseline by default; nudging it up keeps the inline-flex chips
// and Badge rows from shifting when art replaces a glyph.
const BASE = { display: 'inline-block', verticalAlign: '-0.15em', objectFit: 'contain' }

export default function Ico({
  id,
  emoji,
  size = 20,
  color = 'currentColor',
  alt = '',
  title,
  className,
  style,
}) {
  useSyncExternalStore(subscribe, getVersion, getVersion)

  // An id is the normal case. Falling back to an emoji lookup keeps
  // the component usable at call sites that only have the character.
  const key = id || idForEmoji(emoji) || undefined
  const url = urlFor(key)
  const glyph = emoji || emojiFor(key)

  if (url) {
    return (
      <img
        src={url}
        alt={alt}
        title={title}
        data-ico={key}
        className={className}
        onError={() => markBroken(key)}
        style={{ ...BASE, width: size, height: size, ...style }}
      />
    )
  }

  const Svg = key ? FALLBACK_SVG[key] : null
  if (Svg) {
    return (
      <span
        data-ico={key}
        data-ico-fallback="svg"
        title={title}
        className={className}
        style={{ ...BASE, width: size, height: size, lineHeight: 0, ...style }}
      >
        <Svg size={size} color={color} />
      </span>
    )
  }

  if (glyph) {
    return (
      <span
        data-ico={key}
        data-ico-fallback="emoji"
        title={title}
        className={className}
        style={{ fontSize: size, lineHeight: 1, ...style }}
      >{glyph}</span>
    )
  }

  return null
}

/** For the handful of places that need the URL itself rather than an element. */
export function useIconUrl(id) {
  useSyncExternalStore(subscribe, getVersion, getVersion)
  return urlFor(id)
}
