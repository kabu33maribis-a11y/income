import { formatYen } from '../finance'
import { formatShares, type Holding } from '../stock'

type Props = {
  holdings: Holding[]
}

export function HoldingsCard({ holdings }: Props) {
  const invested = holdings.reduce((s, h) => s + h.cost, 0)
  const realized = holdings.reduce((s, h) => s + h.realized, 0)
  const dividends = holdings.reduce((s, h) => s + h.dividends, 0)

  return (
    <section className="chart-card">
      <h3 className="chart-card__title">保有銘柄</h3>
      {holdings.length === 0 ? (
        <p className="chart-card__empty">
          まだ保有はありません。購入・売却を記録するとここに集計されます。
        </p>
      ) : (
        <>
          <ul className="holding-list">
            {holdings.map((h) => (
              <li key={h.ticker} className="holding-row">
                <div className="holding-row__head">
                  <strong>{h.ticker}</strong>
                  <span>
                    {formatShares(h.shares)}株 · 取得額 {formatYen(Math.round(h.cost))}
                  </span>
                </div>
                <div className="holding-row__meta">
                  <span className={h.realized >= 0 ? 'is-income' : 'is-expense'}>
                    実現 {h.realized > 0 ? '+' : ''}
                    {formatYen(Math.round(h.realized))}
                  </span>
                  <span className="is-income">配当 {formatYen(h.dividends)}</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="helper-text">
            保有取得額 {formatYen(Math.round(invested))} / 実現損益合計{' '}
            <span className={realized >= 0 ? 'is-income' : 'is-expense'}>
              {realized > 0 ? '+' : ''}
              {formatYen(Math.round(realized))}
            </span>
            {' · '}配当累計 {formatYen(dividends)}
          </p>
        </>
      )}
    </section>
  )
}
