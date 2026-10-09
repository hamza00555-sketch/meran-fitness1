import Art, { useHasArt } from '../../assets/Art.jsx'
import { achSlot } from '../../assets/slots.js'
import { LockSimple } from '@phosphor-icons/react'
import { medalFace } from './achievementMeta.js'

// ── One medal ─────────────────────────────────────────────────
//
// With the art pack installed: that achievement's own picture, in full
// colour when earned and drained when locked.
//
// Without it — every offline user — a composed medal instead of the old
// emoji on a grey square: a lit disc, the category glyph, the badge's
// own threshold engraved in the numeric face, and a bezel that says the
// rarity (common → rare → epic → legendary runs neutral → silver →
// accent → double accent). No gold: gold means «raise the weight».
//
// Earned always looks better than locked, which the old page had the
// wrong way round.
//
// `size` in px sets --md; leave it out and the surrounding CSS decides
// (the grid scales it with the screen).

export default function Medal({ achievement: a, earned, size, showUnit = false, compact = false }) {
  const hasArt = useHasArt(achSlot(a.id))
  const face = medalFace(a)
  const Glyph = face.glyph
  // compact: too small to engrave — the glyph alone, no lock (the row
  // around it already says how far along it is).
  const mark = compact ? null : face.mark
  const state = earned ? ' md-on' : ' md-off'
  const style = size ? { '--md': `${size}px` } : undefined

  if (hasArt) {
    return (
      <span className={`md md-art md-${a.rarity || 'common'}${state}`} style={style} aria-hidden="true">
        <Art id={achSlot(a.id)} className="md-img" />
        {!earned && !compact && <Lock />}
      </span>
    )
  }

  return (
    <span className={`md md-${a.rarity || 'common'}${state}${mark ? '' : ' md-solo'}`} style={style} aria-hidden="true">
      <span className="md-face">
        <Glyph size={24} weight={earned ? 'fill' : 'regular'} className="md-glyph" />
        {mark && <bdi dir="ltr" className="md-n">{mark.n}</bdi>}
        {mark?.u && showUnit && <span className="md-u">{mark.u}</span>}
      </span>
      {!earned && !compact && <Lock />}
    </span>
  )
}

function Lock() {
  return (
    <span className="md-lock">
      <LockSimple size={12} weight="bold" />
    </span>
  )
}
