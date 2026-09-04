import { formatPct } from '../stock'
import type { EquityPoint, MonthRow } from '../stock'

type LineSeries = {
  key: string
  label: string
  color: string
  values: (number | null)[]
}

function LineChart({
  labels,
  series,
  empty,
}: {
  labels: string[]
  series: LineSeries[]
  empty: string
}) {
  const nums = series.flatMap((s) => s.values.filter((v): v is number => v != null))
  if (labels.length < 2 || nums.length === 0) {
    return <p className="chart-card__empty">{empty}</p>
  }
  const min = Math.min(...nums, 0)
  const max = Math.max(...nums, 0)
  const span = max - min || 1
  const w = 320
  const h = 140
  const pad = 8

  function x(i: number) {
    return pad + (i / Math.max(labels.length - 1, 1)) * (w - pad * 2)
  }
  function y(v: number) {
    return pad + ((max - v) / span) * (h - pad * 2)
  }

  return (
    <svg
      className="stock-svg"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="推移チャート"
    >
      <line
        x1={pad}
        x2={w - pad}
        y1={y(0)}
        y2={y(0)}
        stroke="rgba(26,58,50,0.18)"
        strokeDasharray="3 3"
      />
      {series.map((s) => {
        const pts = s.values
          .map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
          .filter((p): p is string => p != null)
        if (pts.length < 2) return null
        return (
          <polyline
            key={s.key}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            points={pts.join(' ')}
          />
        )
      })}
    </svg>
  )
}

export function EquityChart({ series }: { series: EquityPoint[] }) {
  return (
    <section className="chart-card">
      <h3 className="chart-card__title">資産推移</h3>
      <div className="bar-legend" aria-hidden>
        <span className="bar-legend__item is-income">戦略口座</span>
        <span className="bar-legend__item is-bench">Benchmark口座</span>
      </div>
      <LineChart
        labels={series.map((p) => p.date)}
        series={[
          {
            key: 's',
            label: '戦略',
            color: 'var(--income)',
            values: series.map((p) => p.strategy),
          },
          {
            key: 'b',
            label: 'Benchmark',
            color: 'var(--sat)',
            values: series.map((p) => p.benchmark),
          },
        ]}
        empty="トレードかベンチマーク価格を入れると表示されます"
      />
    </section>
  )
}

export function AlphaChart({ months }: { months: MonthRow[] }) {
  const has = months.some((m) => m.alpha != null || m.cumulativeAlpha != null)
  return (
    <section className="chart-card">
      <h3 className="chart-card__title">Alpha推移</h3>
      {!has ? (
        <p className="chart-card__empty">月次Alphaはベンチマーク価格が必要です</p>
      ) : (
        <>
          <div className="bar-legend" aria-hidden>
            <span className="bar-legend__item is-income">累積Alpha</span>
            <span className="bar-legend__item is-expense">月次Alpha</span>
          </div>
          <LineChart
            labels={months.map((m) => m.label)}
            series={[
              {
                key: 'c',
                label: '累積',
                color: 'var(--income)',
                values: months.map((m) =>
                  m.cumulativeAlpha == null ? null : m.cumulativeAlpha * 100,
                ),
              },
              {
                key: 'm',
                label: '月次',
                color: 'var(--expense)',
                values: months.map((m) => (m.alpha == null ? null : m.alpha * 100)),
              },
            ]}
            empty="まだ比較できる月がありません"
          />
        </>
      )}
    </section>
  )
}

export function DrawdownChart({ series }: { series: EquityPoint[] }) {
  return (
    <section className="chart-card">
      <h3 className="chart-card__title">Drawdown推移</h3>
      <LineChart
        labels={series.map((p) => p.date)}
        series={[
          {
            key: 'dd',
            label: 'DD',
            color: 'var(--danger)',
            values: series.map((p) => p.drawdown * 100),
          },
        ]}
        empty="資産推移ができると表示されます"
      />
      {series.length > 0 ? (
        <p className="helper-text">
          直近 {formatPct(series.at(-1)?.drawdown ?? 0)}
        </p>
      ) : null}
    </section>
  )
}

export function MonthlyPnlChart({ months }: { months: MonthRow[] }) {
  const values = months.map((m) => m.quality.grossProfit - m.quality.grossLoss)
  const max = Math.max(1, ...values.map((v) => Math.abs(v)))
  const has = months.some((m) => m.trades > 0)
  return (
    <section className="chart-card">
      <h3 className="chart-card__title">月次損益</h3>
      {!has ? (
        <p className="chart-card__empty">決済トレードがあると表示されます</p>
      ) : (
        <div className="trend-chart" style={{ gridTemplateColumns: `repeat(${Math.max(months.length, 1)}, 1fr)` }}>
          {months.map((m, i) => {
            const v = values[i]
            const h = Math.abs(v) / max
            return (
              <div key={m.key} className="trend-col">
                <div className="trend-col__pair" style={{ alignItems: v >= 0 ? 'end' : 'start' }}>
                  <div
                    className={['bar-col__bar', v >= 0 ? 'is-income' : 'is-expense'].join(' ')}
                    style={{ height: `${h * 100}%` }}
                    title={`${m.label} ${v.toLocaleString('ja-JP')}円`}
                  />
                </div>
                <span className="trend-col__label">{m.label.replace('年', '/').replace('月', '')}</span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
