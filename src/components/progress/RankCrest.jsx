// ── The rank crest ────────────────────────────────────────────
// The 3D shield for a rank, from the WebP copies (the PNGs are up to
// 1.8MB; they stay for the old design and as the fallback here).

export const crestSrc = (rank) => (rank?.img || '/assets/rank_e.png').replace(/\.png$/, '.webp')

export default function RankCrest({ rank, size = 160, className, style }) {
  return (
    <img
      className={className}
      src={crestSrc(rank)}
      alt=""
      width={size}
      height={size}
      decoding="async"
      style={{ width: size, height: size, objectFit: 'contain', ...style }}
      onError={(e) => {
        const png = rank?.img
        if (png && !e.currentTarget.src.endsWith('.png')) e.currentTarget.src = png
      }}
    />
  )
}
