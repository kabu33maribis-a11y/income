export type StampLabel = {
  id: string
  name: string
  color: string
  ink: string
}

export type PlacedStamp = {
  id: string
  labelId: string
  date: string
}

export type DragPayload =
  | { kind: 'palette'; labelId: string }
  | { kind: 'placed'; stampId: string }

export type LedgerKind = 'income' | 'expense'

export type PaymentMethod =
  | 'cash'
  | 'credit'
  | 'debit'
  | 'emoney'
  | 'transfer'
  | 'broker'
  | 'other'

export type FinanceCategory = {
  id: string
  name: string
  kind: LedgerKind
  color: string
  builtin?: boolean
}

export type LedgerEntry = {
  id: string
  date: string
  categoryId: string
  amount: number
  recoverAmount?: number
  note: string
  paymentMethod?: PaymentMethod
  recurringId?: string
  ticker?: string
  shares?: number
  unitPrice?: number
}

export type CategoryBudget = {
  categoryId: string
  limit: number
}

export type RecurringRule = {
  id: string
  categoryId: string
  amount: number
  note: string
  dayOfMonth: number
  active: boolean
}

export type SavingsGoal = {
  id: string
  name: string
  target: number
  saved: number
  color: string
}

export type AppMode = 'private' | 'stock'

export type TradeSide = 'buy' | 'sell'

export type RuleCompliance = 'ok' | 'partial' | 'ng'

export type MarketEnv = 'up' | 'range' | 'down' | 'crash' | 'event'

export type StockFlowKind = 'deposit' | 'withdraw' | 'coreTransfer'

export type StockStrategy = {
  id: string
  name: string
  startedAt: string
  principal: number
  benchmarkAName: string
  benchmarkBName: string
  allowedDrawdownPct: number
}

export type StockTrade = {
  id: string
  strategyId: string
  symbolCode: string
  symbolName: string
  side: TradeSide
  entryDate: string
  entryPrice: number
  quantity: number
  investedAmount: number
  plannedStop: number | null
  plannedTarget: number | null
  entryReason: string
  marketEnvs: MarketEnv[]
  technicals: string[]
  macros: string[]
  entryCondition: string
  drawdownFromHighPct: number | null
  exitDate: string | null
  exitPrice: number | null
  pnl: number | null
  pnlRate: number | null
  fee: number
  tax: number
  netPnl: number | null
  holdingDays: number | null
  ruleCompliance: RuleCompliance | null
  review: string
}

export type StockFlow = {
  id: string
  date: string
  kind: StockFlowKind
  amount: number
  destination: string
  sourceTradeId: string | null
  note: string
}

export type BenchmarkQuote = {
  date: string
  indexA: number
  etfB: number
}

export type StockAssets = {
  core: number
  domestic: number
  shortTermMark: number | null
}

export type StockEvalState = {
  strategies: StockStrategy[]
  trades: StockTrade[]
  flows: StockFlow[]
  quotes: BenchmarkQuote[]
  assets: StockAssets
}

export type DayMoney = {
  income: number
  expense: number
  net: number
}

export type BackupPayload = {
  version: 1
  exportedAt: string
  stamps: PlacedStamp[]
  stampLabels?: StampLabel[]
  ledger: LedgerEntry[]
  categories: FinanceCategory[]
  budgets: CategoryBudget[]
  recurring: RecurringRule[]
  goals?: SavingsGoal[]
}

export type ModeData = {
  ledger: LedgerEntry[]
  categories: FinanceCategory[]
  budgets: CategoryBudget[]
  recurring: RecurringRule[]
  goals: SavingsGoal[]
}

export type AppSnapshot = {
  version: 2
  updatedAt: string
  mode: AppMode
  stamps: PlacedStamp[]
  stampLabels: StampLabel[]
  private: ModeData
  stock: ModeData
  stockEval: StockEvalState
}
