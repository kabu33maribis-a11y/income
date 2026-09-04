import { useEffect, useMemo, useState } from 'react'
import { MODE_COPY } from '../mode'
import { formatSignedYen } from '../stock'
import {
  categoryStats,
  formatStreak,
  formatWinRate,
  moneyByScope,
  moneyByTradeScope,
  overallFromMoney,
  periodBounds,
  shiftAnchor,
  statsScopes,
  tradeStatsBySymbol,
  trendSeries,
  usesTradeScopes,
  weekdayStats,
  type SeriesKind,
  type StatsPeriod,
} from '../stats'
import type {
  AppMode,
  DayMoney,
  FinanceCategory,
  LedgerEntry,
  StockTrade,
} from '../types'
import { StatsLineChart } from './StatsLineChart'

type Props = {
  mode: AppMode
  month: Date
  onMonthChange: (d: Date) => void
  moneyByDate: Map<string, DayMoney>
  entries: LedgerEntry[]
  categories: FinanceCategory[]
  trades?: StockTrade[]
  onClose: () => void
}

const PERIODS: { id: StatsPeriod; label: string }[] = [
  { id: 'day', label: '日' },
  { id: 'month', label: '月' },
  { id: 'year', label: '年' },
]

export function StatsSheet({
  mode,
  month,
  onMonthChange,
  moneyByDate,
  entries,
  categories,
  trades = [],
  onClose,
}: Props) {
  const copy = MODE_COPY[mode]
  const [period, setPeriod] = useState<StatsPeriod>('day')
  const [series, setSeries] = useState<SeriesKind>('net')
  const [scopeKey, setScopeKey] = useState<string | null>(null)
  const tradeMode = usesTradeScopes(mode, trades)
  const scopes = useMemo(
    () => statsScopes(entries, categories, mode, trades),
    [entries, categories, mode, trades],
  )

  useEffect(() => {
    setScopeKey(null)
  }, [mode])

  const activeMap = useMemo(() => {
    if (!scopeKey) return moneyByDate
    if (tradeMode) return moneyByTradeScope(trades, scopeKey)
    return moneyByScope(entries, categories, mode, scopeKey)
  }, [scopeKey, moneyByDate, tradeMode, trades, entries, categories, mode])

  const bounds = periodBounds(period, month, activeMap)
  const listBounds = periodBounds(period, month, moneyByDate)
  const points = useMemo(
    () => trendSeries(activeMap, period, month),
    [activeMap, period, month],
  )
  const overall = useMemo(
    () => overallFromMoney(activeMap, bounds.start, bounds.end),
    [activeMap, bounds.start, bounds.end],
  )
  const weekdays = useMemo(
    () => weekdayStats(activeMap, bounds.start, bounds.end),
    [activeMap, bounds.start, bounds.end],
  )
  const groups = useMemo(() => {
    if (tradeMode) {
      return tradeStatsBySymbol(trades, listBounds.start, listBounds.end)
    }
    return categoryStats(
      entries,
      categories,
      mode,
      listBounds.start,
      listBounds.end,
    )
  }, [
    tradeMode,
    trades,
    entries,
    categories,
    mode,
    listBounds.start,
    listBounds.end,
  ])

  const selected = scopes.find((s) => s.key === scopeKey) ?? null
  const groupTitle = tradeMode ? '銘柄ごとの勝率' : 'カテゴリごとの勝率'
  const scopeNoun = tradeMode ? '銘柄' : 'カテゴリ'

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="sheet sheet--stats"
        role="dialog"
        aria-modal="true"
        aria-label="統計"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet__header">
          <h2>統計</h2>
          <button
            type="button"
            className="sheet__close"
            onClick={onClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </header>

        <div className="period-toggle" role="tablist" aria-label="集計単位">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={period === p.id}
              className={[
                'period-toggle__btn',
                period === p.id ? 'is-active' : '',
              ].join(' ')}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period !== 'year' ? (
          <div className="year-nav">
            <button
              type="button"
              className="nav-btn"
              onClick={() => onMonthChange(shiftAnchor(period, month, -1))}
              aria-label={period === 'day' ? '前月' : '前年'}
            >
              ‹
            </button>
            <strong>{bounds.label}</strong>
            <button
              type="button"
              className="nav-btn"
              onClick={() => onMonthChange(shiftAnchor(period, month, 1))}
              aria-label={period === 'day' ? '翌月' : '翌年'}
            >
              ›
            </button>
          </div>
        ) : (
          <p className="stats-period-label">{bounds.label}</p>
        )}

        {scopes.length > 0 ? (
          <div className="stats-scope" role="tablist" aria-label={scopeNoun}>
            <button
              type="button"
              role="tab"
              aria-selected={!scopeKey}
              className={['stats-scope__btn', !scopeKey ? 'is-active' : ''].join(
                ' ',
              )}
              onClick={() => setScopeKey(null)}
            >
              すべて
            </button>
            {scopes.map((scope) => (
              <button
                key={scope.key}
                type="button"
                role="tab"
                aria-selected={scopeKey === scope.key}
                className={[
                  'stats-scope__btn',
                  scopeKey === scope.key ? 'is-active' : '',
                ].join(' ')}
                onClick={() =>
                  setScopeKey(scopeKey === scope.key ? null : scope.key)
                }
              >
                <span
                  className="stats-scope__dot"
                  style={{ background: scope.color }}
                />
                {scope.name}
              </button>
            ))}
          </div>
        ) : null}

        <section className="chart-card">
          <div className="stats-card-head">
            <h3 className="chart-card__title">
              {selected
                ? series === 'net'
                  ? `${selected.name}の${copy.net}`
                  : `${selected.name}の累積`
                : series === 'net'
                  ? `${copy.net}の推移`
                  : '累積差額の推移'}
            </h3>
            <div className="series-toggle" role="tablist" aria-label="グラフの種類">
              <button
                type="button"
                className={series === 'net' ? 'is-active' : ''}
                onClick={() => setSeries('net')}
              >
                差額
              </button>
              <button
                type="button"
                className={series === 'cumulative' ? 'is-active' : ''}
                onClick={() => setSeries('cumulative')}
              >
                累積
              </button>
            </div>
          </div>
          <StatsLineChart
            points={points}
            series={series}
            empty={
              selected
                ? `この期間の${selected.name}の記録はまだありません`
                : 'この期間の記録はまだありません'
            }
          />
        </section>

        <section className="chart-card">
          <h3 className="chart-card__title">
            {selected ? `${selected.name}の概要` : 'この期間の概要'}
          </h3>
          <div className="stats-kpis">
            <Kpi
              label="総差額"
              value={formatSignedYen(overall.net)}
              tone={overall.net}
            />
            <Kpi label="勝率" value={formatWinRate(overall.winRate)} />
            <Kpi label="記録日" value={`${overall.days}日`} />
            <Kpi
              label="回収率"
              value={
                overall.recoveryRate == null
                  ? '—'
                  : formatWinRate(overall.recoveryRate)
              }
            />
            <Kpi
              label="平均差額"
              value={formatSignedYen(overall.avgNet)}
              tone={overall.avgNet}
            />
            <Kpi
              label="直近"
              value={formatStreak(overall.streak)}
              tone={overall.streak}
            />
          </div>
          {overall.best && overall.worst ? (
            <p className="stats-extrema">
              最高 {shortDate(overall.best.key)} {formatSignedYen(overall.best.net)}
              {' / '}
              最低 {shortDate(overall.worst.key)} {formatSignedYen(overall.worst.net)}
            </p>
          ) : null}
        </section>

        <section className="chart-card">
          <h3 className="chart-card__title">{groupTitle}</h3>
          {groups.length === 0 ? (
            <p className="chart-card__empty">この期間のカテゴリ記録はありません</p>
          ) : (
            <ul className="win-list">
              {groups.map((g) => (
                <li key={g.key}>
                  <button
                    type="button"
                    className={[
                      'win-row',
                      scopeKey === g.key ? 'is-active' : '',
                    ].join(' ')}
                    aria-pressed={scopeKey === g.key}
                    onClick={() =>
                      setScopeKey(scopeKey === g.key ? null : g.key)
                    }
                  >
                    <div className="win-row__head">
                      <span
                        className="win-row__dot"
                        style={{ background: g.color }}
                      />
                      <strong>{g.name}</strong>
                      <span
                        className={[
                          'win-row__rate',
                          (g.winRate ?? 0) >= 0.5 ? 'is-plus' : 'is-minus',
                        ].join(' ')}
                      >
                        {formatWinRate(g.winRate)}
                      </span>
                    </div>
                    <div className="win-bar" aria-hidden>
                      <div
                        className={[
                          'win-bar__fill',
                          (g.winRate ?? 0) >= 0.5 ? 'is-plus' : 'is-minus',
                        ].join(' ')}
                        style={{
                          width: `${Math.round((g.winRate ?? 0) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="win-row__meta">
                      {g.sessions}戦 {g.wins}勝{g.losses}敗
                      {g.draws ? `${g.draws}分` : ''}
                      {' · '}
                      回収率{' '}
                      {g.recoveryRate == null
                        ? '—'
                        : formatWinRate(g.recoveryRate)}
                      {' · '}
                      <span className={g.net >= 0 ? 'is-income' : 'is-expense'}>
                        {formatSignedYen(g.net)}
                      </span>
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="helper-text">
            {tradeMode
              ? '決済トレードの損益がプラスなら勝ちです。行をタップするとその銘柄だけを表示します。'
              : '同じカテゴリの投資と回収を日ごとにまとめ、差額がプラスなら勝ちです。行をタップするとそのカテゴリだけを表示します。'}
          </p>
        </section>

        <section className="chart-card">
          <h3 className="chart-card__title">
            {selected ? `${selected.name}の曜日別勝率` : '曜日別勝率'}
          </h3>
          {weekdays.every((w) => w.sessions === 0) ? (
            <p className="chart-card__empty">まだ比較できる曜日がありません</p>
          ) : (
            <div className="weekday-stats">
              {weekdays.map((w) => (
                <div
                  key={w.day}
                  className={[
                    'weekday-stat',
                    w.day === 0 ? 'is-sun' : '',
                    w.day === 6 ? 'is-sat' : '',
                  ].join(' ')}
                >
                  <span>{w.label}</span>
                  <strong>{formatWinRate(w.winRate)}</strong>
                  <em>{w.sessions ? `${w.sessions}日` : '—'}</em>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: number
}) {
  return (
    <div
      className={[
        'stats-kpi',
        tone != null && tone > 0 ? 'is-plus' : '',
        tone != null && tone < 0 ? 'is-minus' : '',
      ].join(' ')}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function shortDate(key: string): string {
  const [, m, d] = key.split('-')
  if (!m || !d) return key
  return `${Number(m)}/${Number(d)}`
}
