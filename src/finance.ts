import { format, getDaysInMonth, isSameMonth, parseISO, subMonths } from 'date-fns'
import { getCategory } from './financeCategories'
import type {
  CategoryBudget,
  FinanceCategory,
  LedgerEntry,
  LedgerKind,
  RecurringRule,
} from './types'

export type CategoryTotal = {
  category: FinanceCategory
  total: number
}

export type DailyBar = {
  date: string
  day: number
  income: number
  expense: number
}

export type BudgetProgress = {
  category: FinanceCategory
  limit: number
  spent: number
  ratio: number
}

export function formatYen(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function entryMoney(
  entry: LedgerEntry,
  category: FinanceCategory | undefined,
): { income: number; expense: number } {
  const recover =
    typeof entry.recoverAmount === 'number' &&
    Number.isFinite(entry.recoverAmount) &&
    entry.recoverAmount > 0
      ? entry.recoverAmount
      : 0
  if (!category) return { income: recover, expense: 0 }
  if (recover > 0) {
    if (category.kind === 'income') {
      return { income: entry.amount + recover, expense: 0 }
    }
    return { income: recover, expense: entry.amount }
  }
  if (category.kind === 'income') return { income: entry.amount, expense: 0 }
  return { income: 0, expense: entry.amount }
}

function incomeCategoryFor(
  categories: FinanceCategory[],
  cat: FinanceCategory,
): FinanceCategory | undefined {
  if (cat.kind === 'income') return cat
  return categories.find((c) => c.kind === 'income' && c.name === cat.name)
}

export function entriesInMonth(entries: LedgerEntry[], month: Date): LedgerEntry[] {
  return entries.filter((e) => isSameMonth(parseISO(e.date), month))
}

export function summarizeMonth(
  entries: LedgerEntry[],
  month: Date,
  categories: FinanceCategory[],
) {
  const list = entriesInMonth(entries, month)
  let income = 0
  let expense = 0
  for (const e of list) {
    const cat = getCategory(categories, e.categoryId)
    if (!cat) continue
    const money = entryMoney(e, cat)
    income += money.income
    expense += money.expense
  }
  return { income, expense, net: income - expense, count: list.length }
}

export function moneyByDate(
  entries: LedgerEntry[],
  categories: FinanceCategory[],
) {
  const map = new Map<
    string,
    { income: number; expense: number; net: number }
  >()
  for (const e of entries) {
    const cat = getCategory(categories, e.categoryId)
    if (!cat) continue
    const cur = map.get(e.date) ?? { income: 0, expense: 0, net: 0 }
    const money = entryMoney(e, cat)
    cur.income += money.income
    cur.expense += money.expense
    cur.net = cur.income - cur.expense
    map.set(e.date, cur)
  }
  return map
}

export function totalsByCategory(
  entries: LedgerEntry[],
  month: Date,
  kind: LedgerKind,
  categories: FinanceCategory[],
): CategoryTotal[] {
  const list = entriesInMonth(entries, month)
  const totals = new Map<string, number>()
  for (const e of list) {
    const cat = getCategory(categories, e.categoryId)
    if (!cat) continue
    const money = entryMoney(e, cat)
    if (kind === 'expense' && money.expense > 0) {
      totals.set(cat.id, (totals.get(cat.id) ?? 0) + money.expense)
    }
    if (kind === 'income' && money.income > 0) {
      const incomeCat = incomeCategoryFor(categories, cat)
      if (incomeCat) {
        totals.set(incomeCat.id, (totals.get(incomeCat.id) ?? 0) + money.income)
      }
    }
  }
  return [...totals.entries()]
    .map(([id, total]) => ({ category: getCategory(categories, id)!, total }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total)
}

export function dailyBars(
  entries: LedgerEntry[],
  month: Date,
  categories: FinanceCategory[],
): DailyBar[] {
  const list = entriesInMonth(entries, month)
  const map = moneyByDate(list, categories)
  const year = month.getFullYear()
  const m = month.getMonth()
  const days = getDaysInMonth(month)
  const bars: DailyBar[] = []
  for (let d = 1; d <= days; d++) {
    const date = format(new Date(year, m, d), 'yyyy-MM-dd')
    const money = map.get(date)
    bars.push({
      date,
      day: d,
      income: money?.income ?? 0,
      expense: money?.expense ?? 0,
    })
  }
  return bars
}

export function budgetProgress(
  entries: LedgerEntry[],
  month: Date,
  budgets: CategoryBudget[],
  categories: FinanceCategory[],
): BudgetProgress[] {
  const spentMap = new Map<string, number>()
  for (const e of entriesInMonth(entries, month)) {
    const cat = getCategory(categories, e.categoryId)
    if (!cat) continue
    const money = entryMoney(e, cat)
    if (money.expense <= 0) continue
    spentMap.set(cat.id, (spentMap.get(cat.id) ?? 0) + money.expense)
  }
  return budgets
    .map((b) => {
      const category = getCategory(categories, b.categoryId)
      if (!category || category.kind !== 'expense' || b.limit <= 0) return null
      const spent = spentMap.get(b.categoryId) ?? 0
      return {
        category,
        limit: b.limit,
        spent,
        ratio: spent / b.limit,
      }
    })
    .filter((x): x is BudgetProgress => x !== null)
    .sort((a, b) => b.ratio - a.ratio)
}

export function materializeRecurring(
  entries: LedgerEntry[],
  rules: RecurringRule[],
  month: Date,
  _makeId?: () => string,
): LedgerEntry[] {
  const prefix = format(month, 'yyyy-MM')
  const days = getDaysInMonth(month)
  const additions: LedgerEntry[] = []

  for (const rule of rules) {
    if (!rule.active) continue
    const exists = entries.some(
      (e) => e.recurringId === rule.id && e.date.startsWith(prefix),
    )
    if (exists) continue
    const day = Math.min(Math.max(1, rule.dayOfMonth), days)
    additions.push({
      id: `rec-${rule.id}-${prefix}`,
      date: `${prefix}-${String(day).padStart(2, '0')}`,
      categoryId: rule.categoryId,
      amount: rule.amount,
      note: rule.note,
      recurringId: rule.id,
    })
  }
  return additions
}

export function toCsv(
  entries: LedgerEntry[],
  categories: FinanceCategory[],
): string {
  const header = 'date,kind,category,amount,recover,payment,note'
  const lines = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      const cat = getCategory(categories, e.categoryId)
      const kind = cat?.kind ?? ''
      const name = cat?.name ?? e.categoryId
      const note = `"${e.note.replace(/"/g, '""')}"`
      const payment = e.paymentMethod ?? ''
      const recover = e.recoverAmount && e.recoverAmount > 0 ? e.recoverAmount : ''
      return `${e.date},${kind},${name},${e.amount},${recover},${payment},${note}`
    })
  return [header, ...lines].join('\n')
}

export type MonthTrend = {
  key: string
  label: string
  income: number
  expense: number
  net: number
}

export function monthlyTrends(
  entries: LedgerEntry[],
  categories: FinanceCategory[],
  endMonth: Date,
  count = 6,
): MonthTrend[] {
  const trends: MonthTrend[] = []
  for (let i = count - 1; i >= 0; i--) {
    const m = subMonths(endMonth, i)
    const summary = summarizeMonth(entries, m, categories)
    trends.push({
      key: format(m, 'yyyy-MM'),
      label: format(m, 'M月'),
      income: summary.income,
      expense: summary.expense,
      net: summary.net,
    })
  }
  return trends
}

export type UpcomingBill = {
  rule: RecurringRule
  date: string
  posted: boolean
  daysUntil: number
}

export function upcomingBills(
  rules: RecurringRule[],
  entries: LedgerEntry[],
  month: Date,
  today = new Date(),
): UpcomingBill[] {
  const prefix = format(month, 'yyyy-MM')
  const days = getDaysInMonth(month)
  const todayKey = format(today, 'yyyy-MM-dd')
  return rules
    .filter((r) => r.active)
    .map((rule) => {
      const day = Math.min(Math.max(1, rule.dayOfMonth), days)
      const date = `${prefix}-${String(day).padStart(2, '0')}`
      const posted = entries.some(
        (e) => e.recurringId === rule.id && e.date.startsWith(prefix),
      )
      const daysUntil = Math.round(
        (parseISO(date).getTime() - parseISO(todayKey).getTime()) /
          (24 * 60 * 60 * 1000),
      )
      return { rule, date, posted, daysUntil }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function yearSummary(
  entries: LedgerEntry[],
  categories: FinanceCategory[],
  year: number,
) {
  let income = 0
  let expense = 0
  let monthsWithData = 0
  for (let m = 0; m < 12; m++) {
    const month = new Date(year, m, 1)
    const s = summarizeMonth(entries, month, categories)
    if (s.count > 0) monthsWithData += 1
    income += s.income
    expense += s.expense
  }
  return {
    year,
    income,
    expense,
    net: income - expense,
    monthsWithData,
    avgExpense: monthsWithData ? Math.round(expense / monthsWithData) : 0,
  }
}

export function monthInsights(
  entries: LedgerEntry[],
  month: Date,
  categories: FinanceCategory[],
  budgets: CategoryBudget[],
  today = new Date(),
) {
  const summary = summarizeMonth(entries, month, categories)
  const savingsRate =
    summary.income > 0 ? Math.round((summary.net / summary.income) * 100) : null

  let fixedExpense = 0
  let variableExpense = 0
  for (const e of entriesInMonth(entries, month)) {
    const cat = getCategory(categories, e.categoryId)
    if (!cat) continue
    const money = entryMoney(e, cat)
    if (money.expense <= 0) continue
    if (e.recurringId) fixedExpense += money.expense
    else variableExpense += money.expense
  }

  const progress = budgetProgress(entries, month, budgets, categories)
  const budgetLeft = progress.reduce(
    (s, p) => s + Math.max(p.limit - p.spent, 0),
    0,
  )
  const daysInMonth = getDaysInMonth(month)
  let day = 1
  if (isSameMonth(today, month)) day = today.getDate()
  else if (month.getFullYear() < today.getFullYear() ||
    (month.getFullYear() === today.getFullYear() && month.getMonth() < today.getMonth())) {
    day = daysInMonth
  }
  const daysLeft = Math.max(daysInMonth - day + 1, 1)
  const dailyPace = Math.round(budgetLeft / daysLeft)

  return {
    savingsRate,
    fixedExpense,
    variableExpense,
    budgetLeft,
    dailyPace,
    daysLeft,
  }
}

export function recentNotes(entries: LedgerEntry[], limit = 8): string[] {
  const seen = new Set<string>()
  const notes: string[] = []
  for (const e of [...entries].sort((a, b) => b.date.localeCompare(a.date))) {
    const n = e.note.trim()
    if (!n || seen.has(n)) continue
    seen.add(n)
    notes.push(n)
    if (notes.length >= limit) break
  }
  return notes
}

export function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
