import { formatYen, yearSummary } from '../finance'
import type { ModeCopy } from '../mode'
import type { FinanceCategory, LedgerEntry } from '../types'

type Props = {
  year: number
  entries: LedgerEntry[]
  categories: FinanceCategory[]
  copy: ModeCopy
  onYearChange: (year: number) => void
}

export function YearSummary({
  year,
  entries,
  categories,
  copy,
  onYearChange,
}: Props) {
  const summary = yearSummary(entries, categories, year)
  const thisYear = new Date().getFullYear()

  return (
    <section className="chart-card">
      <h3 className="chart-card__title">年間サマリー</h3>
      <div className="year-nav">
        <button
          type="button"
          className="nav-btn"
          onClick={() => onYearChange(year - 1)}
          aria-label="前年"
        >
          ‹
        </button>
        <strong>{year}年</strong>
        <button
          type="button"
          className="nav-btn"
          onClick={() => onYearChange(Math.min(year + 1, thisYear))}
          aria-label="翌年"
          disabled={year >= thisYear}
        >
          ›
        </button>
      </div>
      <div className="summary-grid">
        <div className="summary-card is-income">
          <span>{copy.yearIncome}</span>
          <strong>{formatYen(summary.income)}</strong>
        </div>
        <div className="summary-card is-expense">
          <span>{copy.yearExpense}</span>
          <strong>{formatYen(summary.expense)}</strong>
        </div>
        <div
          className={[
            'summary-card is-net',
            summary.net >= 0 ? 'is-plus' : 'is-minus',
          ].join(' ')}
        >
          <span>{copy.yearNet}</span>
          <strong>
            {summary.net > 0 ? '+' : ''}
            {formatYen(summary.net)}
          </strong>
          <em className="summary-card__delta">
            記録のある月 {summary.monthsWithData} / {copy.yearAvg}{' '}
            {formatYen(summary.avgExpense)}
          </em>
        </div>
      </div>
    </section>
  )
}
