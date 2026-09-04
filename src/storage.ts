import { BUILTIN_CATEGORIES, mergeCategories } from './financeCategories'
import {
  DEFAULT_STAMP_LABELS,
  inkForColor,
  isStampLabel,
  withInk,
} from './labels'
import { isAppMode } from './mode'
import { normalizeStockState } from './stock'
import type {
  AppMode,
  AppSnapshot,
  BackupPayload,
  CategoryBudget,
  FinanceCategory,
  LedgerEntry,
  ModeData,
  PaymentMethod,
  PlacedStamp,
  RecurringRule,
  SavingsGoal,
  StampLabel,
  StockEvalState,
} from './types'

const MODE_KEY = 'stamp-calendar:mode:v1'
const STAMP_KEY = 'stamp-calendar:v1'
const LABEL_KEY = 'stamp-calendar:labels:v1'
const LEDGER_KEY = 'stamp-calendar:ledger:v1'
const CAT_KEY = 'stamp-calendar:categories:v1'
const BUDGET_KEY = 'stamp-calendar:budgets:v1'
const RECUR_KEY = 'stamp-calendar:recurring:v1'
const GOALS_KEY = 'stamp-calendar:goals:v1'
const STOCK_EVAL_KEY = 'stamp-calendar:stock-eval:v1'

const PAYMENT_IDS = new Set<PaymentMethod>([
  'cash',
  'credit',
  'debit',
  'emoney',
  'transfer',
  'broker',
  'other',
])

function keyFor(base: string, mode: AppMode): string {
  return mode === 'stock' ? `${base}:stock` : base
}

export function loadMode(): AppMode {
  try {
    const raw = localStorage.getItem(MODE_KEY)
    if (isAppMode(raw)) return raw
  } catch {
    /* ignore */
  }
  return 'private'
}

export function saveMode(mode: AppMode): void {
  localStorage.setItem(MODE_KEY, mode)
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function isPaymentMethod(v: unknown): v is PaymentMethod {
  return typeof v === 'string' && PAYMENT_IDS.has(v as PaymentMethod)
}

export function loadStamps(): PlacedStamp[] {
  const parsed = readJson<PlacedStamp[]>(STAMP_KEY, [])
  if (!Array.isArray(parsed)) return []
  return parsed.flatMap((s) => {
    const rec = s as Record<string, unknown>
    const labelId =
      typeof rec.labelId === 'string'
        ? rec.labelId
        : typeof rec.labelId === 'string'
          ? rec.labelId
          : null
    if (
      typeof rec.id !== 'string' ||
      !labelId ||
      typeof rec.date !== 'string'
    ) {
      return []
    }
    return [{ id: rec.id, labelId, date: rec.date }]
  })
}

export function saveStamps(stamps: PlacedStamp[]): void {
  localStorage.setItem(STAMP_KEY, JSON.stringify(stamps))
}

function normalizeLabels(parsed: unknown): StampLabel[] {
  if (!Array.isArray(parsed)) return []
  return parsed
    .filter(isStampLabel)
    .map((l) =>
      withInk({
        id: l.id,
        name: l.name.trim(),
        color: l.color,
        ink: l.ink || inkForColor(l.color),
      }),
    )
}

export function loadStampLabels(): StampLabel[] {
  const parsed = readJson<unknown>(LABEL_KEY, null)
  const labels = normalizeLabels(parsed)
  return labels.length > 0 ? labels : DEFAULT_STAMP_LABELS.map((l) => ({ ...l }))
}

export function saveStampLabels(labels: StampLabel[]): void {
  localStorage.setItem(LABEL_KEY, JSON.stringify(labels))
}

export function loadLedger(mode: AppMode = 'private'): LedgerEntry[] {
  const parsed = readJson<LedgerEntry[]>(keyFor(LEDGER_KEY, mode), [])
  if (!Array.isArray(parsed)) return []
  return parsed
    .filter(
      (e) =>
        typeof e?.id === 'string' &&
        typeof e?.date === 'string' &&
        typeof e?.categoryId === 'string' &&
        typeof e?.amount === 'number' &&
        Number.isFinite(e.amount) &&
        e.amount > 0 &&
        typeof e?.note === 'string',
    )
    .map((e) => ({
      ...e,
      paymentMethod: isPaymentMethod(e.paymentMethod)
        ? e.paymentMethod
        : undefined,
      recoverAmount:
        typeof e.recoverAmount === 'number' &&
        Number.isFinite(e.recoverAmount) &&
        e.recoverAmount > 0
          ? e.recoverAmount
          : undefined,
      ticker:
        typeof e.ticker === 'string' && e.ticker.trim()
          ? e.ticker.trim()
          : undefined,
      shares:
        typeof e.shares === 'number' &&
        Number.isFinite(e.shares) &&
        e.shares > 0
          ? e.shares
          : undefined,
      unitPrice:
        typeof e.unitPrice === 'number' &&
        Number.isFinite(e.unitPrice) &&
        e.unitPrice > 0
          ? e.unitPrice
          : undefined,
    }))
}

export function saveLedger(
  entries: LedgerEntry[],
  mode: AppMode = 'private',
): void {
  localStorage.setItem(keyFor(LEDGER_KEY, mode), JSON.stringify(entries))
}

export function loadCustomCategories(
  mode: AppMode = 'private',
): FinanceCategory[] {
  const parsed = readJson<FinanceCategory[]>(keyFor(CAT_KEY, mode), [])
  if (!Array.isArray(parsed)) return []
  return parsed.filter(
    (c) =>
      typeof c?.id === 'string' &&
      typeof c?.name === 'string' &&
      (c.kind === 'income' || c.kind === 'expense') &&
      typeof c?.color === 'string' &&
      !c.builtin,
  )
}

export function saveCustomCategories(
  categories: FinanceCategory[],
  mode: AppMode = 'private',
): void {
  localStorage.setItem(
    keyFor(CAT_KEY, mode),
    JSON.stringify(categories.filter((c) => !c.builtin)),
  )
}

export function loadAllCategories(mode: AppMode = 'private'): FinanceCategory[] {
  return mergeCategories(loadCustomCategories(mode), mode)
}

export function loadBudgets(mode: AppMode = 'private'): CategoryBudget[] {
  const parsed = readJson<CategoryBudget[]>(keyFor(BUDGET_KEY, mode), [])
  if (!Array.isArray(parsed)) return []
  return parsed.filter(
    (b) =>
      typeof b?.categoryId === 'string' &&
      typeof b?.limit === 'number' &&
      b.limit > 0,
  )
}

export function saveBudgets(
  budgets: CategoryBudget[],
  mode: AppMode = 'private',
): void {
  localStorage.setItem(keyFor(BUDGET_KEY, mode), JSON.stringify(budgets))
}

export function loadRecurring(mode: AppMode = 'private'): RecurringRule[] {
  const parsed = readJson<RecurringRule[]>(keyFor(RECUR_KEY, mode), [])
  if (!Array.isArray(parsed)) return []
  return parsed.filter(
    (r) =>
      typeof r?.id === 'string' &&
      typeof r?.categoryId === 'string' &&
      typeof r?.amount === 'number' &&
      r.amount > 0 &&
      typeof r?.note === 'string' &&
      typeof r?.dayOfMonth === 'number' &&
      typeof r?.active === 'boolean',
  )
}

export function saveRecurring(
  rules: RecurringRule[],
  mode: AppMode = 'private',
): void {
  localStorage.setItem(keyFor(RECUR_KEY, mode), JSON.stringify(rules))
}

export function loadGoals(mode: AppMode = 'private'): SavingsGoal[] {
  const parsed = readJson<SavingsGoal[]>(keyFor(GOALS_KEY, mode), [])
  if (!Array.isArray(parsed)) return []
  return parsed.filter(
    (g) =>
      typeof g?.id === 'string' &&
      typeof g?.name === 'string' &&
      typeof g?.target === 'number' &&
      g.target > 0 &&
      typeof g?.saved === 'number' &&
      g.saved >= 0 &&
      typeof g?.color === 'string',
  )
}

export function saveGoals(
  goals: SavingsGoal[],
  mode: AppMode = 'private',
): void {
  localStorage.setItem(keyFor(GOALS_KEY, mode), JSON.stringify(goals))
}

export function loadStockEval(): StockEvalState {
  return normalizeStockState(readJson<unknown>(STOCK_EVAL_KEY, null))
}

export function saveStockEval(state: StockEvalState): void {
  localStorage.setItem(STOCK_EVAL_KEY, JSON.stringify(state))
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function buildBackup(
  data: Omit<BackupPayload, 'version' | 'exportedAt'>,
): BackupPayload {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    ...data,
  }
}

export function applyBackup(payload: BackupPayload): {
  stamps: PlacedStamp[]
  stampLabels: StampLabel[]
  ledger: LedgerEntry[]
  categories: FinanceCategory[]
  budgets: CategoryBudget[]
  recurring: RecurringRule[]
  goals: SavingsGoal[]
} | null {
  if (payload?.version !== 1) return null
  if (!Array.isArray(payload.ledger) || !Array.isArray(payload.stamps)) {
    return null
  }
  const custom = Array.isArray(payload.categories)
    ? payload.categories.filter(
        (c) => c && !BUILTIN_CATEGORIES.some((b) => b.id === c.id),
      )
    : []
  const stampLabels = normalizeLabels(payload.stampLabels)
  return {
    stamps: payload.stamps,
    stampLabels:
      stampLabels.length > 0
        ? stampLabels
        : DEFAULT_STAMP_LABELS.map((l) => ({ ...l })),
    ledger: payload.ledger,
    categories: mergeCategories(custom, 'private'),
    budgets: Array.isArray(payload.budgets) ? payload.budgets : [],
    recurring: Array.isArray(payload.recurring) ? payload.recurring : [],
    goals: Array.isArray(payload.goals) ? payload.goals : [],
  }
}

function loadModeData(mode: AppMode): ModeData {
  return {
    ledger: loadLedger(mode),
    categories: loadCustomCategories(mode),
    budgets: loadBudgets(mode),
    recurring: loadRecurring(mode),
    goals: loadGoals(mode),
  }
}

function saveModeData(mode: AppMode, data: ModeData): void {
  saveLedger(data.ledger, mode)
  saveCustomCategories(data.categories, mode)
  saveBudgets(data.budgets, mode)
  saveRecurring(data.recurring, mode)
  saveGoals(data.goals, mode)
}

export function isAppSnapshot(v: unknown): v is AppSnapshot {
  if (!v || typeof v !== 'object') return false
  const o = v as Partial<AppSnapshot>
  return (
    o.version === 2 &&
    typeof o.updatedAt === 'string' &&
    isAppMode(o.mode) &&
    !!o.private &&
    typeof o.private === 'object' &&
    !!o.stock &&
    typeof o.stock === 'object'
  )
}

export function readFullSnapshot(): AppSnapshot {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    mode: loadMode(),
    stamps: loadStamps(),
    stampLabels: loadStampLabels(),
    private: loadModeData('private'),
    stock: loadModeData('stock'),
    stockEval: loadStockEval(),
  }
}

export function writeFullSnapshot(snap: AppSnapshot): void {
  saveMode(snap.mode)
  saveStamps(Array.isArray(snap.stamps) ? snap.stamps : [])
  saveStampLabels(Array.isArray(snap.stampLabels) ? snap.stampLabels : [])
  saveModeData('private', {
    ledger: Array.isArray(snap.private.ledger) ? snap.private.ledger : [],
    categories: Array.isArray(snap.private.categories)
      ? snap.private.categories
      : [],
    budgets: Array.isArray(snap.private.budgets) ? snap.private.budgets : [],
    recurring: Array.isArray(snap.private.recurring)
      ? snap.private.recurring
      : [],
    goals: Array.isArray(snap.private.goals) ? snap.private.goals : [],
  })
  saveModeData('stock', {
    ledger: Array.isArray(snap.stock.ledger) ? snap.stock.ledger : [],
    categories: Array.isArray(snap.stock.categories) ? snap.stock.categories : [],
    budgets: Array.isArray(snap.stock.budgets) ? snap.stock.budgets : [],
    recurring: Array.isArray(snap.stock.recurring) ? snap.stock.recurring : [],
    goals: Array.isArray(snap.stock.goals) ? snap.stock.goals : [],
  })
  saveStockEval(normalizeStockState(snap.stockEval))
}

export function snapshotHasData(snap: AppSnapshot): boolean {
  return (
    snap.private.ledger.length > 0 ||
    snap.stock.ledger.length > 0 ||
    snap.stamps.length > 0 ||
    snap.stockEval.trades.length > 0 ||
    snap.stockEval.flows.length > 0 ||
    snap.private.recurring.length > 0 ||
    snap.stock.recurring.length > 0
  )
}
