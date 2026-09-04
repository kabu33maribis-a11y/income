import { useMemo, useState, type FormEvent } from 'react'
import { format } from 'date-fns'
import { formatYen } from '../finance'
import { newId } from '../storage'
import {
  byDrawdownBucket,
  byEntryCondition,
  byMarketEnv,
  byRuleCompliance,
  closedTrades,
  defaultStrategy,
  DESTINATIONS,
  FLOW_LABELS,
  formatPct,
  formatPf,
  formatSignedYen,
  openTrades,
  pfComment,
  plannedRiskReward,
  RULE_LABELS,
  sampleVerdict,
  yearEval,
  buildDashboard,
  type GroupRow,
} from '../stock'
import type {
  BenchmarkQuote,
  StockEvalState,
  StockFlow,
  StockFlowKind,
  StockStrategy,
  StockTrade,
} from '../types'
import {
  AlphaChart,
  DrawdownChart,
  EquityChart,
  MonthlyPnlChart,
} from './StockCharts'
import { TradeForm } from './TradeForm'

type Tab = 'dash' | 'log' | 'funds' | 'analysis'

type Props = {
  state: StockEvalState
  onChange: (state: StockEvalState) => void
}

function Metric({
  label,
  value,
  tone,
  hint,
}: {
  label: string
  value: string
  tone?: 'plus' | 'minus'
  hint?: string
}) {
  return (
    <div
      className={[
        'summary-card',
        tone === 'plus' ? 'is-plus' : '',
        tone === 'minus' ? 'is-minus' : '',
      ].join(' ')}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <em className="summary-card__delta">{hint}</em> : null}
    </div>
  )
}

function QualityTable({ rows }: { rows: GroupRow[] }) {
  if (rows.every((r) => r.quality.count === 0)) {
    return <p className="chart-card__empty">該当する決済トレードがありません</p>
  }
  return (
    <div className="stock-table-wrap">
      <table className="stock-table">
        <thead>
          <tr>
            <th>条件</th>
            <th>回数</th>
            <th>勝率</th>
            <th>平均利益</th>
            <th>平均損失</th>
            <th>PF</th>
          </tr>
        </thead>
        <tbody>
          {rows
            .filter((r) => r.quality.count > 0)
            .map((r) => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td>{r.quality.count}</td>
                <td>{formatPct(r.quality.winRate)}</td>
                <td>
                  {r.quality.avgWin == null ? '—' : formatSignedYen(r.quality.avgWin)}
                </td>
                <td>
                  {r.quality.avgLoss == null
                    ? '—'
                    : formatSignedYen(r.quality.avgLoss)}
                </td>
                <td>{formatPf(r.quality.profitFactor)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}

export function StockPanel({ state, onChange }: Props) {
  const [tab, setTab] = useState<Tab>('dash')
  const [strategyId, setStrategyId] = useState(state.strategies[0]?.id ?? '')
  const [editing, setEditing] = useState<StockTrade | null>(null)
  const [year, setYear] = useState(() => new Date().getFullYear())
  const today = format(new Date(), 'yyyy-MM-dd')

  const strategy =
    state.strategies.find((s) => s.id === strategyId) ?? state.strategies[0]

  const dash = useMemo(
    () => (strategy ? buildDashboard(strategy, state, today) : null),
    [strategy, state, today],
  )

  const scopedTrades = state.trades.filter((t) =>
    strategy ? t.strategyId === strategy.id : true,
  )

  function patch(partial: Partial<StockEvalState>) {
    onChange({ ...state, ...partial })
  }

  function saveTrade(trade: Omit<StockTrade, 'id'> & { id?: string }) {
    if (trade.id) {
      patch({
        trades: state.trades.map((t) =>
          t.id === trade.id ? { ...t, ...trade, id: trade.id } : t,
        ),
      })
      setEditing(null)
      return
    }
    patch({ trades: [...state.trades, { ...trade, id: newId() }] })
  }

  function addFlow(
    kind: StockFlowKind,
    amount: number,
    date: string,
    destination: string,
    note: string,
  ) {
    if (amount <= 0 || !date) return
    const flow: StockFlow = {
      id: newId(),
      date,
      kind,
      amount,
      destination: kind === 'coreTransfer' ? destination : '',
      sourceTradeId: null,
      note,
    }
    patch({ flows: [...state.flows, flow] })
  }

  if (!strategy || !dash) {
    return (
      <section className="finance-panel">
        <p className="chart-card__empty">戦略を作成してください</p>
      </section>
    )
  }

  const yearModel = yearEval(
    strategy,
    state.trades,
    state.flows,
    state.quotes,
    year,
    today,
  )

  return (
    <section className="finance-panel">
      <header className="month-header stock-header">
        <div>
          <h1 className="month-title">{strategy.name}</h1>
          <p className="helper-text" style={{ margin: '0.15rem 0 0' }}>
            {strategy.name} ／ {dash.sample.label}
          </p>
        </div>
        {state.strategies.length > 1 ? (
          <select
            className="stock-strategy-select"
            value={strategy.id}
            onChange={(e) => setStrategyId(e.target.value)}
            aria-label="戦略"
          >
            {state.strategies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        ) : null}
      </header>

      <div className="kind-toggle stock-subnav" role="tablist" aria-label="株メニュー">
        {(
          [
            ['dash', '成績'],
            ['log', '記録'],
            ['funds', '資金'],
            ['analysis', '分析'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={['kind-toggle__btn', tab === id ? 'is-active' : ''].join(' ')}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'dash' ? (
        <DashTab dash={dash} strategy={strategy} assets={state.assets} />
      ) : null}

      {tab === 'log' ? (
        <>
          <section className="chart-card">
            <h3 className="chart-card__title">
              {editing ? 'トレードを編集' : 'トレードを記録'}
            </h3>
            <TradeForm
              key={editing?.id ?? 'new'}
              strategies={state.strategies}
              initialDate={today}
              initial={editing}
              onCancel={editing ? () => setEditing(null) : undefined}
              onSubmit={saveTrade}
            />
          </section>
          <section className="chart-card">
            <h3 className="chart-card__title">
              建玉 {openTrades(scopedTrades).length} / 決済{' '}
              {closedTrades(scopedTrades).length}
            </h3>
            <TradeList
              trades={[
                ...openTrades(scopedTrades),
                ...closedTrades(scopedTrades),
              ].reverse()}
              onEdit={setEditing}
              onDelete={(id) =>
                patch({ trades: state.trades.filter((t) => t.id !== id) })
              }
            />
          </section>
        </>
      ) : null}

      {tab === 'funds' ? (
        <FundsTab
          state={state}
          strategy={strategy}
          onPatch={patch}
          onAddFlow={addFlow}
          onAddStrategy={() => {
            const created = {
              ...defaultStrategy(),
              id: `st-${newId()}`,
              name: '新しい戦略',
            }
            patch({ strategies: [...state.strategies, created] })
            setStrategyId(created.id)
          }}
          onReset={() => {
            if (
              window.confirm(
                '株モードの運用記録をすべて削除します。よろしいですか？',
              )
            ) {
              patch({
                strategies: [defaultStrategy()],
                trades: [],
                flows: [],
                quotes: [],
                assets: { core: 0, domestic: 0, shortTermMark: null },
              })
            }
          }}
        />
      ) : null}

      {tab === 'analysis' ? (
        <AnalysisTab
          year={year}
          onYearChange={setYear}
          yearModel={yearModel}
          months={dash.months}
          trades={scopedTrades}
        />
      ) : null}
    </section>
  )
}

function DashTab({
  dash,
  strategy,
  assets,
}: {
  dash: ReturnType<typeof buildDashboard>
  strategy: StockStrategy
  assets: StockEvalState['assets']
}) {
  return (
    <>
      <section className="chart-card">
        <h3 className="chart-card__title">最重要指標</h3>
        <p className="helper-text" style={{ marginTop: 0 }}>
          「今年いくら儲かったか」ではなく、何もしなかった場合より何円多く増やせたかを見ます。
        </p>
        <div className="summary-grid">
          <Metric
            label="Alpha（対Benchmark）"
            value={formatPct(dash.alpha)}
            tone={dash.alpha == null ? undefined : dash.alpha >= 0 ? 'plus' : 'minus'}
          />
          <Metric
            label="最大ドローダウン"
            value={formatPct(dash.maxDd)}
            tone={
              dash.maxDd < -strategy.allowedDrawdownPct / 100 ? 'minus' : undefined
            }
            hint={`許容 ${strategy.allowedDrawdownPct}%`}
          />
          <Metric
            label="Profit Factor"
            value={formatPf(dash.quality.profitFactor)}
            hint={pfComment(dash.quality.profitFactor)}
          />
          <Metric
            label="平均利益 / 平均損失"
            value={`${dash.quality.avgWin == null ? '—' : formatSignedYen(dash.quality.avgWin)} / ${
              dash.quality.avgLoss == null ? '—' : formatSignedYen(dash.quality.avgLoss)
            }`}
            hint={
              dash.quality.realizedRr != null
                ? `実現RR ${dash.quality.realizedRr.toFixed(2)}`
                : undefined
            }
          />
          <Metric
            label="コア資産への利益移転"
            value={formatYen(dash.coreTransferAll)}
            hint={`当年 ${formatYen(dash.coreTransferYear)}`}
          />
        </div>
      </section>

      <section className="chart-card">
        <h3 className="chart-card__title">戦略成績</h3>
        <div className="summary-grid">
          <Metric label="現在戦略資産" value={formatYen(dash.currentAssets)} />
          <Metric
            label="累積利益（売買）"
            value={formatSignedYen(dash.tradingProfit)}
            tone={dash.tradingProfit >= 0 ? 'plus' : 'minus'}
          />
          <Metric label="累積リターン" value={formatPct(dash.strategyReturn)} />
          <Metric
            label="Benchmarkリターン"
            value={formatPct(dash.benchBReturn)}
            hint={strategy.benchmarkBName}
          />
          <Metric
            label="日経平均リターン"
            value={formatPct(dash.benchAReturn)}
            hint={strategy.benchmarkAName}
          />
          <Metric
            label="Alpha"
            value={formatPct(dash.alpha)}
            tone={dash.alpha == null ? undefined : dash.alpha >= 0 ? 'plus' : 'minus'}
          />
          <Metric label="最大ドローダウン" value={formatPct(dash.maxDd)} />
        </div>
      </section>

      <section className="chart-card">
        <h3 className="chart-card__title">トレード品質</h3>
        <ul className="insight-list">
          <li>
            <span>トレード回数</span>
            <strong>{dash.quality.count}</strong>
          </li>
          <li>
            <span>勝率</span>
            <strong>{formatPct(dash.quality.winRate)}</strong>
          </li>
          <li>
            <span>Profit Factor</span>
            <strong>{formatPf(dash.quality.profitFactor)}</strong>
          </li>
          <li>
            <span>平均利益率</span>
            <strong>{formatPct(dash.quality.avgWinRate)}</strong>
          </li>
          <li>
            <span>平均損失率</span>
            <strong>{formatPct(dash.quality.avgLossRate)}</strong>
          </li>
          <li>
            <span>平均保有日数</span>
            <strong>
              {dash.quality.avgHoldDays == null
                ? '—'
                : `${dash.quality.avgHoldDays.toFixed(1)}日`}
            </strong>
          </li>
          <li>
            <span>ルール遵守率</span>
            <strong>{formatPct(dash.quality.complianceRate)}</strong>
          </li>
        </ul>
        <p className="helper-text">{dash.sample.detail}</p>
      </section>

      <section className="chart-card">
        <h3 className="chart-card__title">資産形成効果</h3>
        <ul className="insight-list">
          <li>
            <span>コア資産</span>
            <strong>{formatYen(assets.core)}</strong>
          </li>
          <li>
            <span>国内株式資産</span>
            <strong>{formatYen(assets.domestic)}</strong>
          </li>
          <li>
            <span>短期売買戦略資産</span>
            <strong>{formatYen(dash.currentAssets)}</strong>
          </li>
          <li>
            <span>コアへの累積移転額</span>
            <strong>{formatYen(dash.coreTransferAll)}</strong>
          </li>
          <li>
            <span>当年移転額</span>
            <strong>{formatYen(dash.coreTransferYear)}</strong>
          </li>
          <li>
            <span>実際の総資産</span>
            <strong>{formatYen(dash.totalActual)}</strong>
          </li>
          <li>
            <span>仮想インデックス資産</span>
            <strong>
              {dash.virtualIndex == null ? '—' : formatYen(dash.virtualIndex)}
            </strong>
          </li>
          <li>
            <span>短期売買による付加価値</span>
            <strong
              className={
                dash.valueAdd == null
                  ? undefined
                  : dash.valueAdd >= 0
                    ? 'is-income'
                    : 'is-expense'
              }
            >
              {dash.valueAdd == null ? '—' : formatSignedYen(dash.valueAdd)}
            </strong>
          </li>
        </ul>
        <p className="helper-text">
          付加価値＝（現在戦略資産＋累積移転）−
          開始時元本をBenchmark ETFへ置いた仮想口座。入金・出金は売買成績から分離しています。
        </p>
      </section>

      {dash.open.length > 0 ? (
        <section className="chart-card">
          <h3 className="chart-card__title">建玉</h3>
          <ul className="entry-list">
            {dash.open.map((t) => (
              <li key={t.id} className="entry-row stock-trade-row">
                <span className="entry-row__dot" style={{ background: '#3d5a80' }} />
                <div className="entry-row__body">
                  <strong>
                    {t.symbolCode} {t.symbolName}
                  </strong>
                  <span className="entry-row__note">
                    {t.entryDate} {t.side === 'buy' ? '買' : '売'} {t.quantity} @{' '}
                    {t.entryPrice}
                  </span>
                </div>
                <span className="entry-row__amt">{formatYen(t.investedAmount)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <EquityChart series={dash.series} />
      <AlphaChart months={dash.months} />
      <DrawdownChart series={dash.series} />
      <MonthlyPnlChart months={dash.months} />
    </>
  )
}

function AnalysisTab({
  year,
  onYearChange,
  yearModel,
  months,
  trades,
}: {
  year: number
  onYearChange: (year: number) => void
  yearModel: ReturnType<typeof yearEval>
  months: ReturnType<typeof buildDashboard>['months']
  trades: StockTrade[]
}) {
  return (
    <>
      <section className="chart-card">
        <h3 className="chart-card__title">年次評価</h3>
        <div className="year-nav">
          <button
            type="button"
            className="nav-btn"
            onClick={() => onYearChange(year - 1)}
            aria-label="前年"
          >
            ‹
          </button>
          <strong>
            {year}年 {yearModel.verdictLabel}
          </strong>
          <button
            type="button"
            className="nav-btn"
            onClick={() =>
              onYearChange(Math.min(year + 1, new Date().getFullYear()))
            }
            aria-label="翌年"
            disabled={year >= new Date().getFullYear()}
          >
            ›
          </button>
        </div>
        <ul className="insight-list">
          <li>
            <span>年間リターン</span>
            <strong>{formatPct(yearModel.strategyReturn)}</strong>
          </li>
          <li>
            <span>Benchmark年間リターン</span>
            <strong>{formatPct(yearModel.benchReturn)}</strong>
          </li>
          <li>
            <span>Alpha</span>
            <strong>{formatPct(yearModel.alpha)}</strong>
          </li>
          <li>
            <span>最大ドローダウン</span>
            <strong>{formatPct(yearModel.maxDd)}</strong>
          </li>
          <li>
            <span>Profit Factor</span>
            <strong>{formatPf(yearModel.quality.profitFactor)}</strong>
          </li>
          <li>
            <span>勝率</span>
            <strong>{formatPct(yearModel.quality.winRate)}</strong>
          </li>
          <li>
            <span>トレード回数</span>
            <strong>{yearModel.tradeCount}</strong>
          </li>
          <li>
            <span>コア移転額</span>
            <strong>{formatYen(yearModel.coreTransfer)}</strong>
          </li>
        </ul>
        <p className="helper-text">{yearModel.sample.detail}</p>
        <ul className="helper-text stock-reasons">
          {yearModel.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <section className="chart-card">
        <h3 className="chart-card__title">月次集計</h3>
        {months.length === 0 ? (
          <p className="chart-card__empty">まだ月次データがありません</p>
        ) : (
          <div className="stock-table-wrap">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>月</th>
                  <th>月末資産</th>
                  <th>月次</th>
                  <th>BM</th>
                  <th>Alpha</th>
                  <th>回数</th>
                  <th>移転</th>
                </tr>
              </thead>
              <tbody>
                {[...months].reverse().map((m) => (
                  <tr key={m.key}>
                    <td>{m.label}</td>
                    <td>{formatYen(m.equity)}</td>
                    <td>{formatPct(m.monthReturn)}</td>
                    <td>{formatPct(m.benchReturn)}</td>
                    <td>{formatPct(m.alpha)}</td>
                    <td>{m.trades}</td>
                    <td>{formatYen(m.coreTransfer)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="chart-card">
        <h3 className="chart-card__title">下落率別</h3>
        <QualityTable rows={byDrawdownBucket(trades)} />
      </section>
      <section className="chart-card">
        <h3 className="chart-card__title">市場トレンド別</h3>
        <QualityTable rows={byMarketEnv(trades)} />
      </section>
      <section className="chart-card">
        <h3 className="chart-card__title">エントリー条件別</h3>
        <QualityTable rows={byEntryCondition(trades)} />
      </section>
      <section className="chart-card">
        <h3 className="chart-card__title">ルール遵守分析</h3>
        <p className="helper-text" style={{ marginTop: 0 }}>
          戦略が悪いのか、戦略を守れていないのかを切り分けます。
        </p>
        <QualityTable rows={byRuleCompliance(trades)} />
      </section>
    </>
  )
}

function TradeList({
  trades,
  onEdit,
  onDelete,
}: {
  trades: StockTrade[]
  onEdit: (t: StockTrade) => void
  onDelete: (id: string) => void
}) {
  if (trades.length === 0) {
    return <p className="entry-list__empty">まだトレードがありません</p>
  }
  return (
    <ul className="entry-list">
      {trades.map((t) => {
        const closed = t.netPnl != null
        const rr = plannedRiskReward(t)
        return (
          <li key={t.id} className="entry-row stock-trade-row">
            <span
              className="entry-row__dot"
              style={{
                background: closed
                  ? (t.netPnl ?? 0) >= 0
                    ? '#2f6f6a'
                    : '#c45c3e'
                  : '#3d5a80',
              }}
            />
            <div className="entry-row__body">
              <strong>
                {t.symbolCode} {t.side === 'buy' ? '買' : '売'}
              </strong>
              <span className="entry-row__note">
                {t.entryDate}
                {t.exitDate ? ` → ${t.exitDate}` : ' 建玉'}
                {t.ruleCompliance ? ` / ${RULE_LABELS[t.ruleCompliance]}` : ''}
                {rr != null ? ` / RR ${rr.toFixed(1)}` : ''}
              </span>
            </div>
            <span
              className={[
                'entry-row__amt',
                closed ? ((t.netPnl ?? 0) >= 0 ? 'is-income' : 'is-expense') : '',
              ].join(' ')}
            >
              {closed ? formatSignedYen(t.netPnl ?? 0) : formatYen(t.investedAmount)}
            </span>
            <button type="button" className="entry-row__del" onClick={() => onEdit(t)}>
              編集
            </button>
            <button
              type="button"
              className="entry-row__del"
              onClick={() => onDelete(t.id)}
            >
              削除
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function FundsTab({
  state,
  strategy,
  onPatch,
  onAddFlow,
  onAddStrategy,
  onReset,
}: {
  state: StockEvalState
  strategy: StockStrategy
  onPatch: (partial: Partial<StockEvalState>) => void
  onAddFlow: (
    kind: StockFlowKind,
    amount: number,
    date: string,
    destination: string,
    note: string,
  ) => void
  onAddStrategy: () => void
  onReset: () => void
}) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [kind, setKind] = useState<StockFlowKind>('deposit')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [destination, setDestination] = useState(DESTINATIONS[0])
  const [note, setNote] = useState('')
  const [qDate, setQDate] = useState(today)
  const [indexA, setIndexA] = useState('')
  const [etfB, setEtfB] = useState('')

  function submitFlow(e: FormEvent) {
    e.preventDefault()
    const n = Number(amount.replace(/,/g, ''))
    if (!Number.isFinite(n) || n <= 0) return
    onAddFlow(kind, Math.round(n), date, destination, note.trim())
    setAmount('')
    setNote('')
  }

  function submitQuote(e: FormEvent) {
    e.preventDefault()
    const a = Number(indexA.replace(/,/g, ''))
    const b = Number(etfB.replace(/,/g, ''))
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return
    const quote: BenchmarkQuote = { date: qDate, indexA: a, etfB: b }
    const rest = state.quotes.filter((q) => q.date !== qDate)
    onPatch({
      quotes: [...rest, quote].sort((x, y) => x.date.localeCompare(y.date)),
    })
    setIndexA('')
    setEtfB('')
  }

  function updateStrategy(next: Partial<StockStrategy>) {
    onPatch({
      strategies: state.strategies.map((s) =>
        s.id === strategy.id ? { ...s, ...next } : s,
      ),
    })
  }

  const sample = sampleVerdict(
    closedTrades(state.trades.filter((t) => t.strategyId === strategy.id)).length,
    strategy.startedAt,
  )

  return (
    <>
      <section className="chart-card">
        <h3 className="chart-card__title">資産区分</h3>
        <p className="helper-text" style={{ marginTop: 0 }}>
          コア（長期）・国内株・短期売買を分けて管理します。コアは移転後の評価額を入力してください。
        </p>
        <label className="field">
          <span>コア資産</span>
          <input
            type="number"
            min={0}
            value={state.assets.core || ''}
            onChange={(e) =>
              onPatch({
                assets: {
                  ...state.assets,
                  core: Math.max(0, Number(e.target.value) || 0),
                },
              })
            }
          />
        </label>
        <label className="field">
          <span>国内株式資産</span>
          <input
            type="number"
            min={0}
            value={state.assets.domestic || ''}
            onChange={(e) =>
              onPatch({
                assets: {
                  ...state.assets,
                  domestic: Math.max(0, Number(e.target.value) || 0),
                },
              })
            }
          />
        </label>
        <label className="field">
          <span>現在戦略資産（任意の上書き）</span>
          <input
            type="number"
            min={0}
            placeholder="空欄なら元本＋損益−移転で計算"
            value={state.assets.shortTermMark ?? ''}
            onChange={(e) => {
              const raw = e.target.value
              onPatch({
                assets: {
                  ...state.assets,
                  shortTermMark: raw === '' ? null : Math.max(0, Number(raw) || 0),
                },
              })
            }}
          />
        </label>
      </section>

      <section className="chart-card">
        <h3 className="chart-card__title">戦略元本・Benchmark</h3>
        <p className="helper-text" style={{ marginTop: 0 }}>
          {sample.detail}
        </p>
        <label className="field">
          <span>戦略名</span>
          <input
            value={strategy.name}
            onChange={(e) => updateStrategy({ name: e.target.value })}
          />
        </label>
        <label className="field">
          <span>開始日</span>
          <input
            type="date"
            value={strategy.startedAt}
            onChange={(e) => updateStrategy({ startedAt: e.target.value })}
          />
        </label>
        <label className="field">
          <span>戦略元本</span>
          <input
            type="number"
            min={0}
            value={strategy.principal || ''}
            onChange={(e) =>
              updateStrategy({ principal: Math.max(0, Number(e.target.value) || 0) })
            }
          />
        </label>
        <label className="field">
          <span>Benchmark A（市場）</span>
          <input
            value={strategy.benchmarkAName}
            onChange={(e) => updateStrategy({ benchmarkAName: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Benchmark B（Buy & Hold）</span>
          <input
            value={strategy.benchmarkBName}
            onChange={(e) => updateStrategy({ benchmarkBName: e.target.value })}
          />
        </label>
        <label className="field">
          <span>許容最大DD（%）</span>
          <input
            type="number"
            min={1}
            value={strategy.allowedDrawdownPct}
            onChange={(e) =>
              updateStrategy({
                allowedDrawdownPct: Math.max(1, Number(e.target.value) || 15),
              })
            }
          />
        </label>
        <button type="button" className="dock-btn dock-btn--ghost" onClick={onAddStrategy}>
          戦略を追加
        </button>
      </section>

      <section className="chart-card">
        <h3 className="chart-card__title">入金・出金・コア移転</h3>
        <form className="ledger-form" onSubmit={submitFlow}>
          <div className="kind-toggle stock-flow-toggle">
            {(['deposit', 'withdraw', 'coreTransfer'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={['kind-toggle__btn', kind === k ? 'is-active' : ''].join(
                  ' ',
                )}
                onClick={() => setKind(k)}
              >
                {FLOW_LABELS[k].replace('外部', '')}
              </button>
            ))}
          </div>
          <label className="field">
            <span>日付</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>金額</span>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
          {kind === 'coreTransfer' ? (
            <label className="field">
              <span>移転先</span>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              >
                {DESTINATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="field">
            <span>メモ</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} />
          </label>
          <button type="submit" className="dock-btn">
            資金移動を記録
          </button>
        </form>
        <ul className="entry-list" style={{ marginTop: '0.7rem' }}>
          {state.flows.length === 0 ? (
            <li className="entry-list__empty">資金移動はまだありません</li>
          ) : (
            [...state.flows]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((f) => (
                <li key={f.id} className="entry-row">
                  <span
                    className="entry-row__dot"
                    style={{
                      background: f.kind === 'deposit' ? '#2f6f6a' : '#c45c3e',
                    }}
                  />
                  <div className="entry-row__body">
                    <strong>
                      {FLOW_LABELS[f.kind]}
                      {f.destination ? ` → ${f.destination}` : ''}
                    </strong>
                    <span className="entry-row__note">
                      {f.date}
                      {f.note ? ` ${f.note}` : ''}
                    </span>
                  </div>
                  <span
                    className={[
                      'entry-row__amt',
                      f.kind === 'deposit' ? 'is-income' : 'is-expense',
                    ].join(' ')}
                  >
                    {f.kind === 'deposit' ? '+' : '-'}
                    {formatYen(f.amount)}
                  </span>
                  <button
                    type="button"
                    className="entry-row__del"
                    onClick={() =>
                      onPatch({ flows: state.flows.filter((x) => x.id !== f.id) })
                    }
                  >
                    削除
                  </button>
                </li>
              ))
          )}
        </ul>
      </section>

      <section className="chart-card">
        <h3 className="chart-card__title">仮想ベンチマーク口座</h3>
        <p className="helper-text" style={{ marginTop: 0 }}>
          開始日と同額を {strategy.benchmarkBName}{' '}
          へ置いた口座と比較します。価格は手動入力です。
        </p>
        <form className="ledger-form" onSubmit={submitQuote}>
          <label className="field">
            <span>日付</span>
            <input
              type="date"
              value={qDate}
              onChange={(e) => setQDate(e.target.value)}
              required
            />
          </label>
          <div className="field-grid">
            <label className="field">
              <span>{strategy.benchmarkAName}</span>
              <input
                type="number"
                step="any"
                min={0}
                placeholder="例: 38000"
                value={indexA}
                onChange={(e) => setIndexA(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>{strategy.benchmarkBName}</span>
              <input
                type="number"
                step="any"
                min={0}
                placeholder="例: 32000"
                value={etfB}
                onChange={(e) => setEtfB(e.target.value)}
                required
              />
            </label>
          </div>
          <button type="submit" className="dock-btn">
            価格を記録
          </button>
        </form>
        <ul className="entry-list" style={{ marginTop: '0.7rem' }}>
          {state.quotes.length === 0 ? (
            <li className="entry-list__empty">
              開始日の価格を入れるとAlphaが計算されます
            </li>
          ) : (
            [...state.quotes]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((q) => (
                <li key={q.date} className="entry-row">
                  <div className="entry-row__body">
                    <strong>{q.date}</strong>
                    <span className="entry-row__note">
                      日経 {q.indexA.toLocaleString('ja-JP')} / ETF{' '}
                      {q.etfB.toLocaleString('ja-JP')}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="entry-row__del"
                    onClick={() =>
                      onPatch({
                        quotes: state.quotes.filter((x) => x.date !== q.date),
                      })
                    }
                  >
                    削除
                  </button>
                </li>
              ))
          )}
        </ul>
      </section>

      <section className="chart-card">
        <h3 className="chart-card__title">データ初期化</h3>
        <p className="helper-text">
          株モードの運用記録だけを消します（家計簿とスタンプは残ります）。
        </p>
        <button type="button" className="dock-btn dock-btn--danger" onClick={onReset}>
          株の記録を消す
        </button>
      </section>
    </>
  )
}
