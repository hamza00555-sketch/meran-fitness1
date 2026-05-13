export default function BarChart({ data = [], valueKey = 'value', labelKey = 'label', color = '#FF6B35', height = 100 }) {
  if (!data.length) {
    return (
      <div style={{
        color: 'var(--text4)', textAlign: 'center',
        padding: '24px 0', fontSize: 12,
        fontFamily: 'var(--font-ar)',
      }}>
        لا يوجد بيانات كافية بعد
      </div>
    )
  }

  const max = Math.max(...data.map(d => d[valueKey])) || 1
  const W = 300
  const n = data.length
  const gap = 4
  const barW = Math.max(8, (W - (n - 1) * gap) / n)

  return (
    <svg
      viewBox={`0 0 ${W} ${height + 24}`}
      style={{ width: '100%', overflow: 'visible' }}
      preserveAspectRatio="none"
    >
      {data.map((d, i) => {
        const bh = Math.max(3, (d[valueKey] / max) * height)
        const x = i * (barW + gap)
        const y = height - bh
        const isLast = i === data.length - 1
        return (
          <g key={i}>
            <rect
              x={x} y={y} width={barW} height={bh}
              rx={3}
              fill={isLast ? color : color + '66'}
            >
              <title>{d[labelKey]}: {d[valueKey]}</title>
            </rect>
            {/* Top value label for last bar */}
            {isLast && (
              <text
                x={x + barW / 2} y={y - 4}
                textAnchor="middle"
                fill={color}
                style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700 }}
              >
                {Math.round(d[valueKey])}
              </text>
            )}
            {/* Bottom date label */}
            <text
              x={x + barW / 2} y={height + 16}
              textAnchor="middle"
              fill="#333"
              style={{ fontSize: 7, fontFamily: 'monospace' }}
            >
              {String(d[labelKey] || '').slice(5)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
