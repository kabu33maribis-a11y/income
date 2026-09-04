import {
  differenceInCalendarDays,
  eachMonthOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
} from 'date-fns'
import { formatYen } from './finance'
import { getCategory } from './financeCategories'
import type { FinanceCategory, LedgerEntry } from './types'
import type {
  BenchmarkQuote,
  DayMoney,
  MarketEnv,
  RuleCompliance,
  StockAssets,
  StockEvalState,
  StockFlow,
  StockFlowKind,
  StockStrategy,
  StockTrade,
  TradeSide,
} from './types'

export type StockKind = 'buy' | 'sell' | 'div' | 'fee'

export type Holding = {
  ticker: string
  shares: number
  cost: number
  realized: number
  dividends: number
}

export type StockMonthStats = {
  buy: number
  sell: number
  dividends: number
  fees: number
  realized: number
}

export const MARKET_ENVS: { id: MarketEnv; label: string }[] = [
  { id: 'up', label: '上昇トレンド' },
  { id: 'range', label: 'レンジ' },
  { id: 'down', label: '下落トレンド' },
  { id: 'crash', label: '急落局面' },
  { id: 'event', label: 'リスクイベント前後' },
]

export const TECHNICALS = [
  '日経平均が200日移動平均線より上',
  '25日移動平均線が上向き',
  '直近高値から3〜7%調整',
  '移動平均線付近まで押している',
  '5日線を再度上抜け',
  '出来高増加',
  'RSI等で売られ過ぎ',
]

export const MACROS = [
  '日銀政策',
  '米国金利',
  '為替',
  'CPI',
  '雇用統計',
  '政策発表',
  '地政学リスク',
]

export const ENTRY_CONDITIONS = [
  '25日線反発',
  '5日線再上抜け',
  'RSI売られ過ぎ',
  '大幅ギャップダウン',
  '急落後反発',
]

export const DRAWDOWN_BUCKETS = [
  { id: '3-5', label: '高値から-3〜5%', min: 3, max: 5 },
  { id: '5-7', label: '-5〜7%', min: 5, max: 7 },
  { id: '7-10', label: '-7〜10%', min: 7, max: 10 },
  { id: '10+', label: '-10%以上', min: 10, max: Infinity },
] as const

export const RULE_LABELS: Record<RuleCompliance, string> = {
  ok: '○ 完全遵守',
  partial: '△ 一部逸脱',
  ng: '× ルール外',
}

export const FLOW_LABELS: Record<StockFlowKind, string> = {
  deposit: '外部入金',
  withdraw: '外部出金',
  coreTransfer: 'コア資産へ移転',
}

export const DESTINATIONS = ['S&P500', '金', '全世界株', 'その他']

export function defaultStrategy(): StockStrategy {
  return {
    id: 'nikkei-leverage-pullback',
    name: '日経レバ押し目',
    startedAt: format(new Date(), 'yyyy-MM-dd'),
    principal: 0,
    benchmarkAName: '日経平均株価',
    benchmarkBName: '日経225連動ETF',
    allowedDrawdownPct: 15,
  }
}

export function defaultStockState(): StockEvalState {
  return {
    strategies: [defaultStrategy()],
    trades: [],
    flows: [],
    quotes: [],
    assets: { core: 0, domestic: 0, shortTermMark: null },
  }
}

const MARKET_IDS = new Set<MarketEnv>(MARKET_ENVS.map((e) => e.id))
const RULE_IDS = new Set<RuleCompliance>(['ok', 'partial', 'ng'])
const FLOW_IDS = new Set<StockFlowKind>(['deposit', 'withdraw', 'coreTransfer'])

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isStr(v: unknown): v is string {
  return typeof v === 'string'
}

function asNum(v: unknown, fallback = 0): number {
  return isNum(v) ? v : fallback
}

function asNullableNum(v: unknown): number | null {
  return isNum(v) ? v : null
}

function parseStrategy(v: unknown): StockStrategy | null {
  if (!v || typeof v !== 'object') return null
  const s = v as Record<string, unknown>
  if (!isStr(s.id) || !isStr(s.name) || !isStr(s.startedAt)) return null
  return {
    id: s.id,
    name: s.name,
    startedAt: s.startedAt,
    principal: Math.max(0, asNum(s.principal)),
    benchmarkAName: isStr(s.benchmarkAName) ? s.benchmarkAName : '日経平均株価',
    benchmarkBName: isStr(s.benchmarkBName) ? s.benchmarkBName : '日経225連動ETF',
    allowedDrawdownPct: Math.max(1, asNum(s.allowedDrawdownPct, 15)),
  }
}

function parseTrade(v: unknown): StockTrade | null {
  if (!v || typeof v !== 'object') return null
  const t = v as Record<string, unknown>
  if (
    !isStr(t.id) ||
    !isStr(t.strategyId) ||
    !isStr(t.symbolCode) ||
    !isStr(t.symbolName) ||
    !isStr(t.entryDate) ||
    !isNum(t.entryPrice) ||
    !isNum(t.quantity)
  ) {
    return null
  }
  const side: TradeSide = t.side === 'sell' ? 'sell' : 'buy'
  const marketEnvs = Array.isArray(t.marketEnvs)
    ? t.marketEnvs.filter((e): e is MarketEnv => isStr(e) && MARKET_IDS.has(e as MarketEnv))
    : []
  const technicals = Array.isArray(t.technicals)
    ? t.technicals.filter((x): x is string => isStr(x) && x.length > 0)
    : []
  const macros = Array.isArray(t.macros)
    ? t.macros.filter((x): x is string => isStr(x) && x.length > 0)
    : []
  const rule =
    isStr(t.ruleCompliance) && RULE_IDS.has(t.ruleCompliance as RuleCompliance)
      ? (t.ruleCompliance as RuleCompliance)
      : null
  const raw: StockTrade = {
    id: t.id,
    strategyId: t.strategyId,
    symbolCode: t.symbolCode,
    symbolName: t.symbolName,
    side,
    entryDate: t.entryDate,
    entryPrice: t.entryPrice,
    quantity: t.quantity,
    investedAmount: asNum(t.investedAmount),
    plannedStop: asNullableNum(t.plannedStop),
    plannedTarget: asNullableNum(t.plannedTarget),
    entryReason: isStr(t.entryReason) ? t.entryReason : '',
    marketEnvs,
    technicals,
    macros,
    entryCondition: isStr(t.entryCondition) ? t.entryCondition : '',
    drawdownFromHighPct: asNullableNum(t.drawdownFromHighPct),
    exitDate: isStr(t.exitDate) && t.exitDate.length > 0 ? t.exitDate : null,
    exitPrice: asNullableNum(t.exitPrice),
    pnl: asNullableNum(t.pnl),
    pnlRate: asNullableNum(t.pnlRate),
    fee: Math.max(0, asNum(t.fee)),
    tax: Math.max(0, asNum(t.tax)),
    netPnl: asNullableNum(t.netPnl),
    holdingDays: asNullableNum(t.holdingDays),
    ruleCompliance: rule,
    review: isStr(t.review) ? t.review : '',
  }
  return deriveTrade(raw)
}

function parseFlow(v: unknown): StockFlow | null {
  if (!v || typeof v !== 'object') return null
  const f = v as Record<string, unknown>
  if (
    !isStr(f.id) ||
    !isStr(f.date) ||
    !isStr(f.kind) ||
    !FLOW_IDS.has(f.kind as StockFlowKind) ||
    !isNum(f.amount) ||
    f.amount <= 0
  ) {
    return null
  }
  return {
    id: f.id,
    date: f.date,
    kind: f.kind as StockFlowKind,
    amount: f.amount,
    destination: isStr(f.destination) ? f.destination : '',
    sourceTradeId: isStr(f.sourceTradeId) ? f.sourceTradeId : null,
    note: isStr(f.note) ? f.note : '',
  }
}

function parseQuote(v: unknown): BenchmarkQuote | null {
  if (!v || typeof v !== 'object') return null
  const q = v as Record<string, unknown>
  if (!isStr(q.date) || !isNum(q.indexA) || !isNum(q.etfB)) return null
  if (q.indexA <= 0 || q.etfB <= 0) return null
  return { date: q.date, indexA: q.indexA, etfB: q.etfB }
}

export function isStockEvalState(v: unknown): v is StockEvalState {
  if (!v || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  return Array.isArray(s.strategies) && Array.isArray(s.trades)
}

export function normalizeStockState(v: unknown): StockEvalState {
  const fallback = defaultStockState()
  if (!v || typeof v !== 'object') return fallback
  const s = v as Record<string, unknown>
  const strategies = Array.isArray(s.strategies)
    ? s.strategies.flatMap((x) => {
        const p = parseStrategy(x)
        return p ? [p] : []
      })
    : []
  const assetsRaw =
    s.assets && typeof s.assets === 'object'
      ? (s.assets as Record<string, unknown>)
      : {}
  return {
    strategies: strategies.length > 0 ? strategies : fallback.strategies,
    trades: Array.isArray(s.trades)
      ? s.trades.flatMap((x) => {
          const p = parseTrade(x)
          return p ? [p] : []
        })
      : [],
    flows: Array.isArray(s.flows)
      ? s.flows.flatMap((x) => {
          const p = parseFlow(x)
          return p ? [p] : []
        })
      : [],
    quotes: Array.isArray(s.quotes)
      ? s.quotes.flatMap((x) => {
          const p = parseQuote(x)
          return p ? [p] : []
        })
      : [],
    assets: {
      core: Math.max(0, asNum(assetsRaw.core)),
      domestic: Math.max(0, asNum(assetsRaw.domestic)),
      shortTermMark: asNullableNum(assetsRaw.shortTermMark),
    },
  }
}

export function deriveTrade(t: StockTrade): StockTrade {
  const invested =
    t.investedAmount > 0 ? t.investedAmount : t.entryPrice * t.quantity
  if (!t.exitDate || t.exitPrice == null) {
    return {
      ...t,
      investedAmount: invested,
      pnl: null,
      pnlRate: null,
      netPnl: null,
      holdingDays: null,
    }
  }
  const dir = t.side === 'buy' ? 1 : -1
  const pnl = (t.exitPrice - t.entryPrice) * t.quantity * dir
  const netPnl = pnl - t.fee - t.tax
  const pnlRate = invested > 0 ? netPnl / invested : 0
  const holdingDays = Math.max(
    0,
    differenceInCalendarDays(parseISO(t.exitDate), parseISO(t.entryDate)),
  )
  return { ...t, investedAmount: invested, pnl, pnlRate, netPnl, holdingDays }
}

export function plannedRiskReward(t: StockTrade): number | null {
  if (t.plannedStop == null || t.plannedTarget == null || t.entryPrice <= 0) {
    return null
  }
  const dir = t.side === 'buy' ? 1 : -1
  const reward = (t.plannedTarget - t.entryPrice) * dir
  const risk = (t.entryPrice - t.plannedStop) * dir
  if (risk <= 0) return null
  return reward / risk
}

export function closedTrades(trades: StockTrade[]): StockTrade[] {
  return trades.filter(
    (t) => t.exitDate && t.exitPrice != null && t.netPnl != null,
  )
}

export function openTrades(trades: StockTrade[]): StockTrade[] {
  return trades.filter((t) => !t.exitDate || t.exitPrice == null)
}

function sum(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0)
}

function mean(ns: number[]): number | null {
  return ns.length === 0 ? null : sum(ns) / ns.length
}

function quoteOnOrBefore(
  quotes: BenchmarkQuote[],
  date: string,
): BenchmarkQuote | null {
  const hit = quotes
    .filter((q) => q.date <= date)
    .sort((a, b) => a.date.localeCompare(b.date))
  return hit.at(-1) ?? null
}

export function benchmarkReturn(
  quotes: BenchmarkQuote[],
  startDate: string,
  asOf: string,
  which: 'A' | 'B',
): number | null {
  const start =
    quoteOnOrBefore(quotes, startDate) ??
    [...quotes].sort((a, b) => a.date.localeCompare(b.date))[0]
  const end = quoteOnOrBefore(quotes, asOf)
  if (!start || !end) return null
  const s = which === 'A' ? start.indexA : start.etfB
  const e = which === 'A' ? end.indexA : end.etfB
  if (s <= 0) return null
  return e / s - 1
}

export function flowTotals(flows: StockFlow[]) {
  let deposit = 0
  let withdraw = 0
  let coreTransfer = 0
  for (const f of flows) {
    if (f.kind === 'deposit') deposit += f.amount
    else if (f.kind === 'withdraw') withdraw += f.amount
    else coreTransfer += f.amount
  }
  return { deposit, withdraw, coreTransfer, netExternal: deposit - withdraw }
}

export function strategyEquity(
  strategy: StockStrategy,
  trades: StockTrade[],
  flows: StockFlow[],
  asOf: string,
): number {
  const closed = closedTrades(trades).filter(
    (t) => t.strategyId === strategy.id && (t.exitDate ?? '') <= asOf,
  )
  const scopedFlows = flows.filter((f) => f.date <= asOf)
  const { deposit, withdraw, coreTransfer } = flowTotals(scopedFlows)
  return (
    strategy.principal +
    deposit -
    withdraw -
    coreTransfer +
    sum(closed.map((t) => t.netPnl ?? 0))
  )
}

export function tradingProfit(
  trades: StockTrade[],
  strategyId: string | null,
  asOf?: string,
): number {
  return sum(
    closedTrades(trades)
      .filter((t) => (strategyId ? t.strategyId === strategyId : true))
      .filter((t) => !asOf || (t.exitDate ?? '') <= asOf)
      .map((t) => t.netPnl ?? 0),
  )
}

export type TradeQuality = {
  count: number
  wins: number
  losses: number
  winRate: number | null
  avgWin: number | null
  avgLoss: number | null
  avgWinRate: number | null
  avgLossRate: number | null
  profitFactor: number | null
  avgHoldDays: number | null
  complianceRate: number | null
  realizedRr: number | null
  grossProfit: number
  grossLoss: number
}

export function tradeQuality(trades: StockTrade[]): TradeQuality {
  const closed = closedTrades(trades)
  const wins = closed.filter((t) => (t.netPnl ?? 0) > 0)
  const losses = closed.filter((t) => (t.netPnl ?? 0) < 0)
  const grossProfit = sum(wins.map((t) => t.netPnl ?? 0))
  const grossLoss = Math.abs(sum(losses.map((t) => t.netPnl ?? 0)))
  const withRule = closed.filter((t) => t.ruleCompliance)
  const ok = withRule.filter((t) => t.ruleCompliance === 'ok')
  const avgWin = mean(wins.map((t) => t.netPnl ?? 0))
  const avgLoss = mean(losses.map((t) => t.netPnl ?? 0))
  return {
    count: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length === 0 ? null : wins.length / closed.length,
    avgWin,
    avgLoss,
    avgWinRate: mean(wins.map((t) => t.pnlRate ?? 0)),
    avgLossRate: mean(losses.map((t) => t.pnlRate ?? 0)),
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    avgHoldDays: mean(closed.map((t) => t.holdingDays ?? 0)),
    complianceRate: withRule.length === 0 ? null : ok.length / withRule.length,
    realizedRr:
      avgWin != null && avgLoss != null && avgLoss !== 0
        ? Math.abs(avgWin / avgLoss)
        : null,
    grossProfit,
    grossLoss,
  }
}

export function pfComment(pf: number | null): string {
  if (pf == null) return '損失トレードなし（または未決済）'
  if (pf < 1) return '戦略としてマイナス'
  if (pf < 1.3) return '優位性が弱い'
  if (pf < 1.5) return '継続検証対象'
  if (pf < 2) return '良好'
  return '非常に良好。再現性の確認が必要'
}

export type SampleVerdict = {
  label: string
  detail: string
}

export function sampleVerdict(
  tradeCount: number,
  startedAt: string,
  asOf = format(new Date(), 'yyyy-MM-dd'),
): SampleVerdict {
  const days = Math.max(
    0,
    differenceInCalendarDays(parseISO(asOf), parseISO(startedAt)),
  )
  const years = days / 365
  const period =
    years < 1
      ? `経過 ${days}日（目安は最低1年）`
      : `経過 ${years.toFixed(1)}年`
  if (tradeCount < 30) {
    return {
      label: '記録中',
      detail: `短期間の結果では評価しません。暫定評価は30トレードから。${period}`,
    }
  }
  if (tradeCount < 50) {
    return { label: '暫定評価', detail: `30トレード到達。${period}` }
  }
  if (tradeCount < 100) {
    return { label: '一次評価', detail: `50トレード到達。${period}` }
  }
  return { label: '本格評価', detail: `100トレード以上。${period}` }
}

export type EquityPoint = {
  date: string
  strategy: number
  benchmark: number | null
  drawdown: number
  alpha: number | null
}

function uniqueDates(dates: string[]): string[] {
  return [...new Set(dates.filter(Boolean))].sort()
}

export function equitySeries(
  strategy: StockStrategy,
  trades: StockTrade[],
  flows: StockFlow[],
  quotes: BenchmarkQuote[],
  asOf = format(new Date(), 'yyyy-MM-dd'),
): EquityPoint[] {
  const scopedTrades = trades.filter((t) => t.strategyId === strategy.id)
  const dates = uniqueDates([
    strategy.startedAt,
    ...scopedTrades.map((t) => t.entryDate),
    ...scopedTrades.flatMap((t) => (t.exitDate ? [t.exitDate] : [])),
    ...flows.map((f) => f.date),
    ...quotes.map((q) => q.date),
    asOf,
  ]).filter((d) => d >= strategy.startedAt && d <= asOf)

  let peak = 0
  return dates.map((date) => {
    const equity = strategyEquity(strategy, scopedTrades, flows, date)
    peak = Math.max(peak, equity)
    const dd = peak > 0 ? equity / peak - 1 : 0
    const benchR = benchmarkReturn(quotes, strategy.startedAt, date, 'B')
    const bench =
      benchR == null ? null : strategy.principal * (1 + benchR)
    const stratR =
      strategy.principal > 0
        ? equityAdjustedReturn(strategy, scopedTrades, date)
        : null
    const alpha =
      stratR != null && benchR != null ? stratR - benchR : null
    return { date, strategy: equity, benchmark: bench, drawdown: dd, alpha }
  })
}

export function equityAdjustedReturn(
  strategy: StockStrategy,
  trades: StockTrade[],
  asOf: string,
): number | null {
  if (strategy.principal <= 0) return null
  const profit = tradingProfit(trades, strategy.id, asOf)
  return profit / strategy.principal
}

export function maxDrawdown(series: EquityPoint[]): number {
  if (series.length === 0) return 0
  return Math.min(0, ...series.map((p) => p.drawdown))
}

export function currentStrategyAssets(
  strategy: StockStrategy,
  trades: StockTrade[],
  flows: StockFlow[],
  assets: StockAssets,
  asOf = format(new Date(), 'yyyy-MM-dd'),
): number {
  if (assets.shortTermMark != null && assets.shortTermMark > 0) {
    return assets.shortTermMark
  }
  return strategyEquity(strategy, trades, flows, asOf)
}

export type GroupRow = {
  key: string
  label: string
  quality: TradeQuality
}

function groupBy(
  trades: StockTrade[],
  keyFn: (t: StockTrade) => { key: string; label: string }[],
): GroupRow[] {
  const map = new Map<string, { label: string; trades: StockTrade[] }>()
  for (const t of closedTrades(trades)) {
    const keys = keyFn(t)
    if (keys.length === 0) {
      const cur = map.get('other') ?? { label: 'その他', trades: [] }
      cur.trades.push(t)
      map.set('other', cur)
      continue
    }
    for (const k of keys) {
      const cur = map.get(k.key) ?? { label: k.label, trades: [] }
      cur.trades.push(t)
      map.set(k.key, cur)
    }
  }
  return [...map.entries()].map(([key, v]) => ({
    key,
    label: v.label,
    quality: tradeQuality(v.trades),
  }))
}

export function byMarketEnv(trades: StockTrade[]): GroupRow[] {
  return groupBy(trades, (t) =>
    t.marketEnvs.map((id) => ({
      key: id,
      label: MARKET_ENVS.find((e) => e.id === id)?.label ?? id,
    })),
  )
}

export function byEntryCondition(trades: StockTrade[]): GroupRow[] {
  return groupBy(trades, (t) =>
    t.entryCondition
      ? [{ key: t.entryCondition, label: t.entryCondition }]
      : [],
  )
}

export function drawdownBucket(pct: number | null): string | null {
  if (pct == null || !Number.isFinite(pct)) return null
  const abs = Math.abs(pct)
  const hit = DRAWDOWN_BUCKETS.find((b) => abs >= b.min && abs < b.max)
  return hit?.id ?? (abs >= 10 ? '10+' : null)
}

export function byDrawdownBucket(trades: StockTrade[]): GroupRow[] {
  return groupBy(trades, (t) => {
    const id = drawdownBucket(t.drawdownFromHighPct)
    if (!id) return []
    const label = DRAWDOWN_BUCKETS.find((b) => b.id === id)?.label ?? id
    return [{ key: id, label }]
  })
}

export function byRuleCompliance(trades: StockTrade[]): GroupRow[] {
  const closed = closedTrades(trades)
  const ok = closed.filter((t) => t.ruleCompliance === 'ok')
  const off = closed.filter(
    (t) => t.ruleCompliance === 'partial' || t.ruleCompliance === 'ng',
  )
  return [
    { key: 'ok', label: 'ルール遵守（○）', quality: tradeQuality(ok) },
    { key: 'off', label: 'ルール逸脱（△×）', quality: tradeQuality(off) },
  ]
}

export type MonthRow = {
  key: string
  label: string
  equity: number
  monthReturn: number | null
  benchReturn: number | null
  alpha: number | null
  cumulativeAlpha: number | null
  maxDd: number
  trades: number
  quality: TradeQuality
  coreTransfer: number
}

export function monthlyRows(
  strategy: StockStrategy,
  trades: StockTrade[],
  flows: StockFlow[],
  quotes: BenchmarkQuote[],
  asOf = format(new Date(), 'yyyy-MM-dd'),
): MonthRow[] {
  if (strategy.startedAt > asOf) return []
  const months = eachMonthOfInterval({
    start: startOfMonth(parseISO(strategy.startedAt)),
    end: startOfMonth(parseISO(asOf)),
  })
  const series = equitySeries(strategy, trades, flows, quotes, asOf)
  const scoped = trades.filter((t) => t.strategyId === strategy.id)

  return months.map((monthDate, i) => {
    const end = format(
      monthDate > parseISO(asOf) ? parseISO(asOf) : endOfMonth(monthDate),
      'yyyy-MM-dd',
    )
    const capped = end > asOf ? asOf : end
    const prevEnd =
      i === 0
        ? strategy.startedAt
        : format(endOfMonth(months[i - 1]), 'yyyy-MM-dd')
    const equity = strategyEquity(strategy, scoped, flows, capped)
    const prevEquity = strategyEquity(strategy, scoped, flows, prevEnd)
    const monthTrades = closedTrades(scoped).filter((t) =>
      isSameMonth(parseISO(t.exitDate ?? t.entryDate), monthDate),
    )
    const monthFlows = flows.filter((f) => isSameMonth(parseISO(f.date), monthDate))
    const stratR =
      prevEquity > 0 ? equity / prevEquity - 1 : null
    const benchNow = benchmarkReturn(quotes, strategy.startedAt, capped, 'B')
    const benchPrev = benchmarkReturn(quotes, strategy.startedAt, prevEnd, 'B')
    const benchMonth =
      benchNow != null && benchPrev != null
        ? (1 + benchNow) / (1 + benchPrev) - 1
        : benchmarkReturn(quotes, prevEnd, capped, 'B')
    const monthAlpha =
      stratR != null && benchMonth != null ? stratR - benchMonth : null
    const cumAlpha = series.find((p) => p.date === capped)?.alpha ?? null
    const maxDd = maxDrawdown(series.filter((p) => p.date <= capped))
    return {
      key: format(monthDate, 'yyyy-MM'),
      label: format(monthDate, 'yyyy年M月'),
      equity,
      monthReturn: stratR,
      benchReturn: benchMonth,
      alpha: monthAlpha,
      cumulativeAlpha: cumAlpha,
      maxDd,
      trades: monthTrades.length,
      quality: tradeQuality(monthTrades),
      coreTransfer: flowTotals(monthFlows).coreTransfer,
    }
  })
}

export type YearVerdict = 'good' | 'watch' | 'bad'

export type YearEval = {
  year: number
  strategyReturn: number | null
  benchReturn: number | null
  alpha: number | null
  maxDd: number
  quality: TradeQuality
  coreTransfer: number
  tradeCount: number
  verdict: YearVerdict
  verdictLabel: string
  reasons: string[]
  sample: SampleVerdict
}

export function yearEval(
  strategy: StockStrategy,
  trades: StockTrade[],
  flows: StockFlow[],
  quotes: BenchmarkQuote[],
  year: number,
  asOf = format(new Date(), 'yyyy-MM-dd'),
): YearEval {
  const start = `${year}-01-01`
  const end = year === new Date().getFullYear() ? asOf : `${year}-12-31`
  const scoped = trades.filter((t) => t.strategyId === strategy.id)
  const yearClosed = closedTrades(scoped).filter((t) =>
    (t.exitDate ?? '').startsWith(String(year)),
  )
  const yearFlows = flows.filter((f) => f.date.startsWith(String(year)))
  const quality = tradeQuality(yearClosed)
  const series = equitySeries(strategy, scoped, flows, quotes, end)
  const startEq = strategyEquity(
    strategy,
    scoped,
    flows,
    start < strategy.startedAt ? strategy.startedAt : start,
  )
  const endEq = strategyEquity(strategy, scoped, flows, end)
  const strategyReturn = startEq > 0 ? endEq / startEq - 1 : equityAdjustedReturn(strategy, scoped, end)
  const from = start < strategy.startedAt ? strategy.startedAt : start
  const benchReturn = benchmarkReturn(quotes, from, end, 'B')
  const alpha =
    strategyReturn != null && benchReturn != null
      ? strategyReturn - benchReturn
      : null
  const maxDd = maxDrawdown(series)
  const sample = sampleVerdict(quality.count, strategy.startedAt, end)
  const allowed = -Math.abs(strategy.allowedDrawdownPct) / 100
  const reasons: string[] = []
  let verdict: YearVerdict = 'watch'

  const pf = quality.profitFactor
  const compliance = quality.complianceRate ?? 0
  if (
    (alpha ?? 0) >= 0.02 &&
    (pf ?? 0) >= 1.5 &&
    maxDd >= allowed &&
    compliance >= 0.7 &&
    quality.count >= 30
  ) {
    verdict = 'good'
  }
  if ((alpha != null && alpha < 0) || (pf != null && pf < 1) || maxDd < allowed) {
    verdict = 'bad'
  }
  if (alpha != null) {
    reasons.push(
      alpha >= 0.02
        ? `Alpha ${formatPct(alpha)}（Benchmark+2%以上）`
        : `Alpha ${formatPct(alpha)}`,
    )
  }
  if (pf != null) reasons.push(`Profit Factor ${pf.toFixed(2)}（${pfComment(pf)}）`)
  reasons.push(`最大DD ${formatPct(maxDd)} / 許容 ${formatPct(allowed)}`)
  if (quality.complianceRate != null) {
    reasons.push(`ルール遵守率 ${formatPct(quality.complianceRate)}`)
  }
  if (quality.count < 30) reasons.push('サンプル不足')

  const verdictLabel =
    verdict === 'good' ? '○ 良好' : verdict === 'bad' ? '× 見直し' : '△ 要検証'

  return {
    year,
    strategyReturn,
    benchReturn,
    alpha,
    maxDd,
    quality,
    coreTransfer: flowTotals(yearFlows).coreTransfer,
    tradeCount: quality.count,
    verdict,
    verdictLabel,
    reasons,
    sample,
  }
}

export type DashboardModel = {
  strategy: StockStrategy
  asOf: string
  currentAssets: number
  tradingProfit: number
  strategyReturn: number | null
  benchAReturn: number | null
  benchBReturn: number | null
  alpha: number | null
  maxDd: number
  quality: TradeQuality
  coreTransferAll: number
  coreTransferYear: number
  valueAdd: number | null
  virtualIndex: number | null
  actualShort: number
  totalActual: number
  series: EquityPoint[]
  months: MonthRow[]
  open: StockTrade[]
  sample: SampleVerdict
}

export function buildDashboard(
  strategy: StockStrategy,
  state: StockEvalState,
  asOf = format(new Date(), 'yyyy-MM-dd'),
): DashboardModel {
  const trades = state.trades.filter((t) => t.strategyId === strategy.id)
  const series = equitySeries(strategy, trades, state.flows, state.quotes, asOf)
  const currentAssets = currentStrategyAssets(
    strategy,
    trades,
    state.flows,
    state.assets,
    asOf,
  )
  const profit = tradingProfit(trades, strategy.id, asOf)
  const strategyReturn = equityAdjustedReturn(strategy, trades, asOf)
  const benchAReturn = benchmarkReturn(
    state.quotes,
    strategy.startedAt,
    asOf,
    'A',
  )
  const benchBReturn = benchmarkReturn(
    state.quotes,
    strategy.startedAt,
    asOf,
    'B',
  )
  const alpha =
    strategyReturn != null && benchBReturn != null
      ? strategyReturn - benchBReturn
      : null
  const { coreTransfer } = flowTotals(state.flows)
  const yearKey = asOf.slice(0, 4)
  const coreTransferYear = flowTotals(
    state.flows.filter((f) => f.date.startsWith(yearKey)),
  ).coreTransfer
  const virtualIndex =
    benchBReturn == null ? null : strategy.principal * (1 + benchBReturn)
  const actualShort = currentAssets + coreTransfer
  const valueAdd = virtualIndex == null ? null : actualShort - virtualIndex
  const quality = tradeQuality(trades)

  return {
    strategy,
    asOf,
    currentAssets,
    tradingProfit: profit,
    strategyReturn,
    benchAReturn,
    benchBReturn,
    alpha,
    maxDd: maxDrawdown(series),
    quality,
    coreTransferAll: coreTransfer,
    coreTransferYear,
    valueAdd,
    virtualIndex,
    actualShort,
    totalActual: state.assets.core + state.assets.domestic + currentAssets,
    series,
    months: monthlyRows(strategy, trades, state.flows, state.quotes, asOf),
    open: openTrades(trades),
    sample: sampleVerdict(quality.count, strategy.startedAt, asOf),
  }
}

export function stockMoneyByDate(
  trades: StockTrade[],
  flows: StockFlow[],
): Map<string, DayMoney> {
  const map = new Map<string, DayMoney>()
  function bump(date: string, income: number, expense: number) {
    const cur = map.get(date) ?? { income: 0, expense: 0, net: 0 }
    cur.income += income
    cur.expense += expense
    cur.net = cur.income - cur.expense
    map.set(date, cur)
  }
  for (const t of trades) {
    bump(t.entryDate, 0, t.investedAmount)
    if (t.exitDate && t.netPnl != null) {
      bump(t.exitDate, t.investedAmount + t.netPnl, 0)
    }
  }
  for (const f of flows) {
    if (f.kind === 'deposit') bump(f.date, f.amount, 0)
    else bump(f.date, 0, f.amount)
  }
  return map
}

export function formatPct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const pct = n * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(digits)}%`
}

export function formatSignedYen(n: number): string {
  if (n > 0) return `+${formatYen(n)}`
  return formatYen(n)
}

export function formatPf(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toFixed(2)
}

function tickerKey(entry: LedgerEntry): string {
  const t = entry.ticker?.trim().toUpperCase()
  return t && t.length > 0 ? t : '（未設定）'
}

export function classifyStock(
  entry: LedgerEntry,
  category: FinanceCategory | undefined,
): StockKind {
  if (!category) return 'fee'
  if (category.id === 'stock-buy') return 'buy'
  if (category.id === 'stock-sell') return 'sell'
  if (category.id === 'stock-div') return 'div'
  if (category.id === 'stock-fee') return 'fee'
  if (category.kind === 'expense' && (entry.shares ?? 0) > 0) return 'buy'
  if (category.kind === 'income' && (entry.shares ?? 0) > 0) return 'sell'
  if (category.kind === 'income') return 'div'
  return 'fee'
}

export function analyzeStock(
  entries: LedgerEntry[],
  categories: FinanceCategory[],
  month?: Date,
): { holdings: Holding[]; month: StockMonthStats } {
  const sorted = [...entries].sort((a, b) => {
    const d = a.date.localeCompare(b.date)
    return d !== 0 ? d : a.id.localeCompare(b.id)
  })
  const map = new Map<string, Holding>()
  const monthStats: StockMonthStats = {
    buy: 0,
    sell: 0,
    dividends: 0,
    fees: 0,
    realized: 0,
  }

  function holding(ticker: string): Holding {
    const cur = map.get(ticker)
    if (cur) return cur
    const created: Holding = {
      ticker,
      shares: 0,
      cost: 0,
      realized: 0,
      dividends: 0,
    }
    map.set(ticker, created)
    return created
  }

  for (const e of sorted) {
    const cat = getCategory(categories, e.categoryId)
    const kind = classifyStock(e, cat)
    const ticker = tickerKey(e)
    const inMonth = month ? isSameMonth(parseISO(e.date), month) : false
    const h = holding(ticker)

    if (kind === 'buy') {
      h.shares += e.shares ?? 0
      h.cost += e.amount
      if (inMonth) monthStats.buy += e.amount
    } else if (kind === 'sell') {
      const soldShares = e.shares ?? 0
      const avg = h.shares > 0 ? h.cost / h.shares : 0
      const take = Math.min(soldShares, h.shares)
      const soldCost = avg * take
      h.shares = Math.max(h.shares - take, 0)
      h.cost = Math.max(h.cost - soldCost, 0)
      const realized = e.amount - soldCost
      h.realized += realized
      if (inMonth) {
        monthStats.sell += e.amount
        monthStats.realized += realized
      }
    } else if (kind === 'div') {
      h.dividends += e.amount
      if (inMonth) monthStats.dividends += e.amount
    } else if (inMonth) {
      monthStats.fees += e.amount
    }

    if (e.recoverAmount && e.recoverAmount > 0) {
      h.realized += e.recoverAmount
      if (inMonth) {
        monthStats.sell += e.recoverAmount
        monthStats.realized += e.recoverAmount
      }
    }
  }

  const holdings = [...map.values()]
    .filter(
      (h) =>
        h.shares > 0 || h.cost > 0 || h.realized !== 0 || h.dividends > 0,
    )
    .sort((a, b) => a.ticker.localeCompare(b.ticker, 'ja'))

  return { holdings, month: monthStats }
}

export function formatShares(n: number): string {
  if (!Number.isFinite(n)) return '0'
  if (Number.isInteger(n)) return String(n)
  return n.toLocaleString('ja-JP', { maximumFractionDigits: 4 })
}
