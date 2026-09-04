import type { MonthTrend } from '../finance'
import { formatYen } from '../finance'
import type { ModeCopy } from '../mode'

type Props = {
  trends: MonthTrend[]
  copy: ModeCopy
}

export function MonthTrendChart({ trends, copy }: Props) {
  const max = Math.max(1, ...trends.flatMap((t) => [t.income, t.expense]))
  const hasData = trends.some((t) => t.income > 0 || t.expense > 0)

  return (
    <section className="chart-card">
      <h3 className="chart-card__title">直近6ヶ月の推移</h3>
      {!hasData ? (
        <p className="chart-card__empty">まだ比較できる記録がありません</p>
      ) : (
        <>
          <div className="bar-legend" aria-hidden>
            <span className="bar-legend__item is-income">{copy.income}</span>
            <span className="bar-legend__item is-expense">{copy.expense}</span>
          </div>
          <div className="trend-chart">
            {trends.map((t) => (
              <div key={t.key} className="trend-col">
                <div className="trend-col__pair">
                  <div
                    className="bar-col__bar is-income"
                    style={{ height: `${(t.income / max) * 100}%` }}
                    title={`${copy.income} ${formatYen(t.income)}`}
                  />
                  <div
                    className="bar-col__bar is-expense"
                    style={{ height: `${(t.expense / max) * 100}%` }}
                    title={`${copy.expense} ${formatYen(t.expense)}`}
                  />
                </div>
                <span className="trend-col__label">{t.label}</span>
                <span
                  className={[
                    'trend-col__net',
                    t.net >= 0 ? 'is-income' : 'is-expense',
                  ].join(' ')}
                >
                  {t.net > 0 ? '+' : ''}
                  {compact(t.net)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function compact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 10000) return `${Math.round(n / 1000) / 10}万`
  return String(n)
}
