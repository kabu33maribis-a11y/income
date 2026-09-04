import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  deriveTrade,
  ENTRY_CONDITIONS,
  MACROS,
  MARKET_ENVS,
  plannedRiskReward,
  RULE_LABELS,
  TECHNICALS,
} from '../stock'
import type {
  MarketEnv,
  RuleCompliance,
  StockStrategy,
  StockTrade,
  TradeSide,
} from '../types'

type Props = {
  strategies: StockStrategy[]
  initialDate: string
  initial?: StockTrade | null
  onSubmit: (trade: Omit<StockTrade, 'id'> & { id?: string }) => void
  onCancel?: () => void
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
}

function num(raw: string): number {
  const n = Number(raw.replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function optNum(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

export function TradeForm({
  strategies,
  initialDate,
  initial = null,
  onSubmit,
  onCancel,
}: Props) {
  const [strategyId, setStrategyId] = useState(
    initial?.strategyId ?? strategies[0]?.id ?? '',
  )
  const [symbolCode, setSymbolCode] = useState(initial?.symbolCode ?? '1570')
  const [symbolName, setSymbolName] = useState(
    initial?.symbolName ?? 'NF・日経レバETF',
  )
  const [side, setSide] = useState<TradeSide>(initial?.side ?? 'buy')
  const [entryDate, setEntryDate] = useState(initial?.entryDate ?? initialDate)
  const [entryPrice, setEntryPrice] = useState(
    initial ? String(initial.entryPrice) : '',
  )
  const [quantity, setQuantity] = useState(
    initial ? String(initial.quantity) : '',
  )
  const [invested, setInvested] = useState(
    initial && initial.investedAmount > 0 ? String(initial.investedAmount) : '',
  )
  const [plannedStop, setPlannedStop] = useState(
    initial?.plannedStop != null ? String(initial.plannedStop) : '',
  )
  const [plannedTarget, setPlannedTarget] = useState(
    initial?.plannedTarget != null ? String(initial.plannedTarget) : '',
  )
  const [entryReason, setEntryReason] = useState(initial?.entryReason ?? '')
  const [marketEnvs, setMarketEnvs] = useState<MarketEnv[]>(
    initial?.marketEnvs ?? [],
  )
  const [technicals, setTechnicals] = useState<string[]>(
    initial?.technicals ?? [],
  )
  const [macros, setMacros] = useState<string[]>(initial?.macros ?? [])
  const [entryCondition, setEntryCondition] = useState(
    initial?.entryCondition ?? '',
  )
  const [drawdownFromHigh, setDrawdownFromHigh] = useState(
    initial?.drawdownFromHighPct != null
      ? String(initial.drawdownFromHighPct)
      : '',
  )
  const [exitDate, setExitDate] = useState(initial?.exitDate ?? '')
  const [exitPrice, setExitPrice] = useState(
    initial?.exitPrice != null ? String(initial.exitPrice) : '',
  )
  const [fee, setFee] = useState(initial && initial.fee > 0 ? String(initial.fee) : '')
  const [tax, setTax] = useState(initial && initial.tax > 0 ? String(initial.tax) : '')
  const [ruleCompliance, setRuleCompliance] = useState<RuleCompliance | ''>(
    initial?.ruleCompliance ?? '',
  )
  const [review, setReview] = useState(initial?.review ?? '')

  useEffect(() => {
    if (!initial) {
      setEntryDate(initialDate)
      return
    }
    setStrategyId(initial.strategyId)
    setSymbolCode(initial.symbolCode)
    setSymbolName(initial.symbolName)
    setSide(initial.side)
    setEntryDate(initial.entryDate)
    setEntryPrice(String(initial.entryPrice))
    setQuantity(String(initial.quantity))
    setInvested(initial.investedAmount > 0 ? String(initial.investedAmount) : '')
    setPlannedStop(initial.plannedStop != null ? String(initial.plannedStop) : '')
    setPlannedTarget(
      initial.plannedTarget != null ? String(initial.plannedTarget) : '',
    )
    setEntryReason(initial.entryReason)
    setMarketEnvs(initial.marketEnvs)
    setTechnicals(initial.technicals)
    setMacros(initial.macros)
    setEntryCondition(initial.entryCondition)
    setDrawdownFromHigh(
      initial.drawdownFromHighPct != null
        ? String(initial.drawdownFromHighPct)
        : '',
    )
    setExitDate(initial.exitDate ?? '')
    setExitPrice(initial.exitPrice != null ? String(initial.exitPrice) : '')
    setFee(initial.fee > 0 ? String(initial.fee) : '')
    setTax(initial.tax > 0 ? String(initial.tax) : '')
    setRuleCompliance(initial.ruleCompliance ?? '')
    setReview(initial.review)
  }, [initial, initialDate])

  const preview = useMemo(() => {
    const draft: StockTrade = {
      id: initial?.id ?? 'preview',
      strategyId,
      symbolCode,
      symbolName,
      side,
      entryDate,
      entryPrice: num(entryPrice),
      quantity: num(quantity),
      investedAmount: num(invested),
      plannedStop: optNum(plannedStop),
      plannedTarget: optNum(plannedTarget),
      entryReason,
      marketEnvs,
      technicals,
      macros,
      entryCondition,
      drawdownFromHighPct: optNum(drawdownFromHigh),
      exitDate: exitDate || null,
      exitPrice: optNum(exitPrice),
      pnl: null,
      pnlRate: null,
      fee: Math.max(0, num(fee)),
      tax: Math.max(0, num(tax)),
      netPnl: null,
      holdingDays: null,
      ruleCompliance: ruleCompliance || null,
      review,
    }
    return deriveTrade(draft)
  }, [
    initial?.id,
    strategyId,
    symbolCode,
    symbolName,
    side,
    entryDate,
    entryPrice,
    quantity,
    invested,
    plannedStop,
    plannedTarget,
    entryReason,
    marketEnvs,
    technicals,
    macros,
    entryCondition,
    drawdownFromHigh,
    exitDate,
    exitPrice,
    fee,
    tax,
    ruleCompliance,
    review,
  ])

  const rr = plannedRiskReward(preview)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!strategyId || !symbolCode.trim() || !entryDate) return
    if (preview.entryPrice <= 0 || preview.quantity <= 0) return
    onSubmit({ ...preview, id: initial?.id })
    if (!initial) {
      setEntryPrice('')
      setQuantity('')
      setInvested('')
      setEntryReason('')
      setReview('')
      setExitDate('')
      setExitPrice('')
      setFee('')
      setTax('')
    }
  }

  return (
    <form className="ledger-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>戦略</span>
        <select
          value={strategyId}
          onChange={(e) => setStrategyId(e.target.value)}
          required
        >
          {strategies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <div className="kind-toggle" role="group" aria-label="売買区分">
        <button
          type="button"
          className={['kind-toggle__btn is-income', side === 'buy' ? 'is-active' : ''].join(' ')}
          onClick={() => setSide('buy')}
        >
          買い
        </button>
        <button
          type="button"
          className={['kind-toggle__btn', side === 'sell' ? 'is-active' : ''].join(' ')}
          onClick={() => setSide('sell')}
        >
          売り
        </button>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>銘柄コード</span>
          <input
            value={symbolCode}
            onChange={(e) => setSymbolCode(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>銘柄名</span>
          <input
            value={symbolName}
            onChange={(e) => setSymbolName(e.target.value)}
          />
        </label>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>エントリー日</span>
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>エントリー価格</span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            value={entryPrice}
            onChange={(e) => setEntryPrice(e.target.value)}
            required
          />
        </label>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>数量</span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>投入金額</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="空欄なら価格×数量"
            value={invested}
            onChange={(e) => setInvested(e.target.value)}
          />
        </label>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>想定損切</span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            value={plannedStop}
            onChange={(e) => setPlannedStop(e.target.value)}
          />
        </label>
        <label className="field">
          <span>想定利確</span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            value={plannedTarget}
            onChange={(e) => setPlannedTarget(e.target.value)}
          />
        </label>
      </div>
      {rr != null ? (
        <p className="helper-text">想定リスクリワード {rr.toFixed(2)}</p>
      ) : null}

      <p className="sheet__form-title">エントリー理由（可能な限り売買前に）</p>
      <div className="chip-row" role="group" aria-label="市場環境">
        {MARKET_ENVS.map((env) => (
          <button
            key={env.id}
            type="button"
            className={[
              'quick-note',
              marketEnvs.includes(env.id) ? 'is-on' : '',
            ].join(' ')}
            onClick={() => setMarketEnvs(toggle(marketEnvs, env.id))}
          >
            {env.label}
          </button>
        ))}
      </div>
      <div className="chip-row" role="group" aria-label="テクニカル">
        {TECHNICALS.map((item) => (
          <button
            key={item}
            type="button"
            className={[
              'quick-note',
              technicals.includes(item) ? 'is-on' : '',
            ].join(' ')}
            onClick={() => setTechnicals(toggle(technicals, item))}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="chip-row" role="group" aria-label="マクロ">
        {MACROS.map((item) => (
          <button
            key={item}
            type="button"
            className={['quick-note', macros.includes(item) ? 'is-on' : ''].join(
              ' ',
            )}
            onClick={() => setMacros(toggle(macros, item))}
          >
            {item}
          </button>
        ))}
      </div>
      <label className="field">
        <span>エントリー条件</span>
        <select
          value={entryCondition}
          onChange={(e) => setEntryCondition(e.target.value)}
        >
          <option value="">未選択</option>
          {ENTRY_CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>高値からの下落率（%）</span>
        <input
          type="number"
          inputMode="decimal"
          step="any"
          placeholder="例: 6.5"
          value={drawdownFromHigh}
          onChange={(e) => setDrawdownFromHigh(e.target.value)}
        />
      </label>
      <label className="field">
        <span>判断根拠（自由記述）</span>
        <textarea
          rows={2}
          value={entryReason}
          onChange={(e) => setEntryReason(e.target.value)}
          maxLength={400}
        />
      </label>

      <p className="sheet__form-title">決済</p>
      <div className="field-grid">
        <label className="field">
          <span>決済日</span>
          <input
            type="date"
            value={exitDate}
            onChange={(e) => setExitDate(e.target.value)}
          />
        </label>
        <label className="field">
          <span>決済価格</span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            value={exitPrice}
            onChange={(e) => setExitPrice(e.target.value)}
          />
        </label>
      </div>
      <div className="field-grid">
        <label className="field">
          <span>手数料</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
        </label>
        <label className="field">
          <span>税金</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={tax}
            onChange={(e) => setTax(e.target.value)}
          />
        </label>
      </div>
      {preview.netPnl != null ? (
        <p className="helper-text">
          最終損益 {preview.netPnl > 0 ? '+' : ''}
          {Math.round(preview.netPnl).toLocaleString('ja-JP')}円
          {preview.pnlRate != null
            ? `（${(preview.pnlRate * 100).toFixed(1)}%）`
            : ''}
          {preview.holdingDays != null ? ` / 保有${preview.holdingDays}日` : ''}
        </p>
      ) : null}

      <label className="field">
        <span>ルール遵守</span>
        <select
          value={ruleCompliance}
          onChange={(e) =>
            setRuleCompliance(e.target.value as RuleCompliance | '')
          }
        >
          <option value="">未記入</option>
          {(Object.keys(RULE_LABELS) as RuleCompliance[]).map((k) => (
            <option key={k} value={k}>
              {RULE_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>振り返り</span>
        <textarea
          rows={2}
          value={review}
          onChange={(e) => setReview(e.target.value)}
          maxLength={400}
          placeholder="判断の良否・改善点"
        />
      </label>

      <div className="ledger-form__actions">
        {onCancel ? (
          <button
            type="button"
            className="dock-btn dock-btn--ghost"
            onClick={onCancel}
          >
            キャンセル
          </button>
        ) : null}
        <button type="submit" className="dock-btn">
          {initial ? 'トレードを更新' : 'トレードを記録'}
        </button>
      </div>
    </form>
  )
}
