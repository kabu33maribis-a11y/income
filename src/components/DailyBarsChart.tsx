import type { DailyBar } from '../finance'
import { formatYen } from '../finance'
import type { ModeCopy } from '../mode'

type Props = {
  bars: DailyBar[]
  copy: ModeCopy
}

export function DailyBarsChart({ bars, copy }: Props) {
  const max = Math.max(1, ...bars.map((b) => Math.max(b.income, b.expense)))
  const hasData = bars.some((b) => b.income > 0 || b.expense > 0)

  return (
    <section className="chart-card">
      <h3 className="chart-card__title">{copy.dailyTitle}</h3>
      {!hasData ? (
        <p className="chart-card__empty">この月の記録はまだありません</p>
      ) : (
        <>
          <div className="bar-legend" aria-hidden>
            <span className="bar-legend__item is-income">{copy.income}</span>
            <span className="bar-legend__item is-expense">{copy.expense}</span>
          </div>
          <div className="bar-scroll">
            <div
              className="bar-chart"
              style={{ ['--bar-count' as string]: bars.length }}
            >
              {bars.map((b) => (
                <div key={b.date} className="bar-col" title={dayTitle(b, copy)}>
                  <div className="bar-col__pair">
                    <div
                      className="bar-col__bar is-income"
                      style={{ height: `${(b.income / max) * 100}%` }}
                    />
                    <div
                      className="bar-col__bar is-expense"
                      style={{ height: `${(b.expense / max) * 100}%` }}
                    />
                  </div>
                  <span className="bar-col__label">
                    {b.day % 5 === 1 || b.day === bars.length ? b.day : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

function dayTitle(b: DailyBar, copy: ModeCopy): string {
  return `${b.day}日 ${copy.income} ${formatYen(b.income)} / ${copy.expense} ${formatYen(b.expense)}`
}
