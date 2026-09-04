import { formatYen } from '../finance'
import type { SeriesKind, TrendPoint } from '../stats'

type Props = {
  points: TrendPoint[]
  series: SeriesKind
  empty: string
}

export function StatsLineChart({ points, series, empty }: Props) {
  const values = points.map((p) => (series === 'net' ? p.net : p.cumulative))
  const hasData = values.some((v) => v !== 0)
  if (points.length === 0 || !hasData) {
    return <p className="chart-card__empty">{empty}</p>
  }

  const min = Math.min(...values, 0)
  const max = Math.max(...values, 0)
  const span = max - min || 1
  const w = 320
  const h = 148
  const padL = 8
  const padR = 8
  const padT = 10
  const padB = 22

  function x(i: number) {
    return padL + (i / Math.max(points.length - 1, 1)) * (w - padL - padR)
  }
  function y(v: number) {
    return padT + ((max - v) / span) * (h - padT - padB)
  }

  const coords = values.map((v, i) => ({ x: x(i), y: y(v), v }))
  const line = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const zeroY = y(0)
  const area = `${coords[0].x.toFixed(1)},${zeroY.toFixed(1)} ${line} ${coords[coords.length - 1].x.toFixed(1)},${zeroY.toFixed(1)}`
  const last = coords[coords.length - 1]
  const stroke = last.v >= 0 ? 'var(--income)' : 'var(--expense)'
  const fill = last.v >= 0 ? 'rgba(47, 111, 106, 0.16)' : 'rgba(196, 92, 62, 0.16)'
  const labelEvery =
    points.length > 20 ? 7 : points.length > 12 ? 3 : points.length > 6 ? 2 : 1

  return (
    <div className="stats-chart">
      <svg
        className="stock-svg"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="推移チャート"
      >
        <line
          x1={padL}
          x2={w - padR}
          y1={zeroY}
          y2={zeroY}
          stroke="rgba(26,58,50,0.18)"
          strokeDasharray="3 3"
        />
        <polygon fill={fill} points={area} />
        {coords.length === 1 ? (
          <circle cx={coords[0].x} cy={coords[0].y} r="3.2" fill={stroke} />
        ) : (
          <polyline
            fill="none"
            stroke={stroke}
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={line}
          />
        )}
        {coords.map((c, i) => (
          <circle key={points[i].key} cx={c.x} cy={c.y} r="2.1" fill={stroke}>
            <title>
              {points[i].label} {c.v > 0 ? '+' : ''}
              {formatYen(c.v)}
            </title>
          </circle>
        ))}
        {points.map((p, i) => {
          const show =
            i === 0 ||
            i === points.length - 1 ||
            i % labelEvery === 0
          if (!show) return null
          return (
            <text
              key={`l-${p.key}`}
              x={x(i)}
              y={h - 6}
              textAnchor="middle"
              fill="currentColor"
              className="stats-chart__tick"
            >
              {p.label}
            </text>
          )
        })}
      </svg>
      <p className="stats-chart__scale" aria-hidden>
        <span>{max > 0 ? `+${formatYen(max)}` : formatYen(max)}</span>
        <span>{min < 0 ? formatYen(min) : formatYen(0)}</span>
      </p>
    </div>
  )
}
