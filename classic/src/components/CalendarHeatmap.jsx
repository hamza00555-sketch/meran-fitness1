import { buildCalendarData } from '../utils.js'

const HEAT_COLORS = ['#1a1a1a', '#FF6B3535', '#FF6B3565', '#FF6B3595', '#FF6B35']

function getColor(count) {
  if (!count) return HEAT_COLORS[0]
  if (count === 1) return HEAT_COLORS[1]
  if (count === 2) return HEAT_COLORS[2]
  if (count === 3) return HEAT_COLORS[3]
  return HEAT_COLORS[4]
}

export default function CalendarHeatmap({ sessions, weeks = 14 }) {
  const days = buildCalendarData(sessions, weeks)

  // Group into week columns
  const cols = []
  let col = []
  const firstDow = new Date(days[0]?.iso).getDay()
  for (let i = 0; i < firstDow; i++) col.push(null) // padding
  for (const d of days) {
    col.push(d)
    if (col.length === 7) { cols.push(col); col = [] }
  }
  if (col.length) {
    while (col.length < 7) col.push(null)
    cols.push(col)
  }

  const DAY_LABELS = ['أح', 'إث', 'ث', 'أر', 'خ', 'ج', 'س']

  return (
    <div>
      <div style={{ display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 4 }}>
        {/* Day labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginLeft: 4 }}>
          {DAY_LABELS.map((l, i) => (
            <div key={i} style={{
              width: 12, height: 12,
              fontSize: 7, color: 'var(--text4)',
              fontFamily: 'var(--font-mono)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{i % 2 === 0 ? l : ''}</div>
          ))}
        </div>

        {/* Week columns */}
        {cols.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {week.map((d, di) => (
              <div
                key={di}
                title={d ? `${d.iso} · ${d.count} جلسة` : ''}
                style={{
                  width: 12, height: 12, borderRadius: 3,
                  background: d ? getColor(d.count) : 'transparent',
                  cursor: d?.count ? 'pointer' : 'default',
                  transition: 'transform 0.1s',
                }}
                onMouseOver={e => d?.count && (e.currentTarget.style.transform = 'scale(1.3)')}
                onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
        <span style={{ fontSize: 9, color: 'var(--text4)', fontFamily: 'var(--font-mono)' }}>أقل</span>
        {HEAT_COLORS.map((c, i) => (
          <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
        ))}
        <span style={{ fontSize: 9, color: 'var(--text4)', fontFamily: 'var(--font-mono)' }}>أكثر</span>
      </div>
    </div>
  )
}
