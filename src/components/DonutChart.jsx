export default function DonutChart({ segments, size = 180, strokeWidth = 22, children }) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, d) => s + (d.value || 0), 0);

  let cumulativePct = 0;
  const gap = total > 0 ? 0.012 : 0;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2A2660" strokeWidth={strokeWidth} />
        {total > 0 && segments.map((seg, i) => {
          const pct = (seg.value || 0) / total;
          const dash = Math.max(0, (pct - gap) * circumference);
          const offset = circumference * (1 - cumulativePct);
          cumulativePct += pct;
          if (pct < 0.001) return null;
          return (
            <circle key={i} cx={cx} cy={cy} r={r}
              fill="none" stroke={seg.color} strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={offset}
              strokeLinecap="butt"
              style={{ transition: 'stroke-dasharray .5s ease' }}
            />
          );
        })}
      </svg>
      {children && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          textAlign: 'center',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}
