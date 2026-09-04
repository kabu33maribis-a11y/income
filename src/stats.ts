import {
  addMonths,
  addYears,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfYear,
  format,
  getDay,
  parseISO,
  startOfMonth,
  startOfYear,
} from 'date-fns'
import { entryMoney } from './finance'
import { CATEGORY_COLORS, getCategory } from './financeCategories'
import { closedTrades } from './stock'
import type {
  AppMode,
  DayMoney,
  FinanceCategory,
  LedgerEntry,
  StockTrade,
} from './types'

export type StatsPeriod = 'day' | 'month' | 'year'
export type SeriesKind = 'net' | 'cumulative'

export type TrendPoint = {
  key: string
  label: string
  income: number
  expense: number
  net: number
  cumulative: number
}

export type GroupStat = {
  key: string
  name: string
  color: string
  sessions: number
  wins: number
  losses: number
  draws: number
  winRate: number | null
  invest: number
  recover: number
  net: number
  recoveryRate: number | null
  avgNet: number
}

export type OverallStat = {
  days: number
  wins: number
  losses: number
  draws: number
  winRate: number | null
  income: number
  expense: number
  net: number
  recoveryRate: number | null
  avgNet: number
  streak: number
  best: { key: string; label: string; net: number } | null
  worst: { key: string; label: string; net: number } | null
}

export type WeekdayStat = {
  day: number
  label: string
  sessions: number
  wins: number
  winRate: number | null
}

export type StatsScope = {
  key: string
  name: string
  color: string
}

export function formatWinRate(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const pct = n * 100
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`
}

export function formatStreak(n: number): string {
  if (n > 0) return `${n}連勝`
  if (n < 0) return `${-n}連敗`
  return '—'
}

function ratio(num: number, den: number): number | null {
  if (den <= 0) return null
  return num / den
}

function rate(wins: number, losses: number, draws: number): number | null {
  const n = wins + losses + draws
  if (n === 0) return null
  return wins / n
}

export function periodBounds(
  period: StatsPeriod,
  anchor: Date,
  moneyByDate: Map<string, DayMoney>,
): { start: string; end: string; label: string } {
  if (period === 'day') {
    return {
      start: format(startOfMonth(anchor), 'yyyy-MM-dd'),
      end: format(endOfMonth(anchor), 'yyyy-MM-dd'),
      label: format(anchor, 'yyyy年 M月'),
    }
  }
  if (period === 'month') {
    return {
      start: format(startOfYear(anchor), 'yyyy-MM-dd'),
      end: format(endOfYear(anchor), 'yyyy-MM-dd'),
      label: format(anchor, 'yyyy年'),
    }
  }
  const keys = [...moneyByDate.keys()].sort()
  return {
    start: keys[0] ?? format(startOfYear(anchor), 'yyyy-MM-dd'),
    end: keys[keys.length - 1] ?? format(endOfYear(anchor), 'yyyy-MM-dd'),
    label: '全期間',
  }
}

function sumMoney(
  moneyByDate: Map<string, DayMoney>,
  start: string,
  end: string,
): DayMoney {
  let income = 0
  let expense = 0
  for (const [date, money] of moneyByDate) {
    if (date < start || date > end) continue
    income += money.income
    expense += money.expense
  }
  return { income, expense, net: income - expense }
}

function withCumulative(
  points: Omit<TrendPoint, 'cumulative'>[],
): TrendPoint[] {
  let run = 0
  return points.map((point) => {
    run += point.net
    return { ...point, cumulative: run }
  })
}

export function trendSeries(
  moneyByDate: Map<string, DayMoney>,
  period: StatsPeriod,
  anchor: Date,
): TrendPoint[] {
  if (period === 'day') {
    const days = eachDayOfInterval({
      start: startOfMonth(anchor),
      end: endOfMonth(anchor),
    })
    return withCumulative(
      days.map((day) => {
        const key = format(day, 'yyyy-MM-dd')
        const money = moneyByDate.get(key) ?? { income: 0, expense: 0, net: 0 }
        return {
          key,
          label: String(day.getDate()),
          income: money.income,
          expense: money.expense,
          net: money.net,
        }
      }),
    )
  }

  if (period === 'month') {
    const months = eachMonthOfInterval({
      start: startOfYear(anchor),
      end: endOfYear(anchor),
    })
    return withCumulative(
      months.map((month) => {
        const money = sumMoney(
          moneyByDate,
          format(startOfMonth(month), 'yyyy-MM-dd'),
          format(endOfMonth(month), 'yyyy-MM-dd'),
        )
        return {
          key: format(month, 'yyyy-MM'),
          label: `${month.getMonth() + 1}月`,
          ...money,
        }
      }),
    )
  }

  const keys = [...moneyByDate.keys()].sort()
  let min = anchor.getFullYear()
  let max = min
  for (const key of keys) {
    const year = Number(key.slice(0, 4))
    if (!Number.isFinite(year)) continue
    min = Math.min(min, year)
    max = Math.max(max, year)
  }
  min = Math.max(min, max - 9)
  if (max === min) min = max - 1
  return withCumulative(
    Array.from({ length: max - min + 1 }, (_, i) => {
      const year = min + i
      return {
        key: String(year),
        label: String(year),
        ...sumMoney(moneyByDate, `${year}-01-01`, `${year}-12-31`),
      }
    }),
  )
}

export function overallFromMoney(
  moneyByDate: Map<string, DayMoney>,
  start: string,
  end: string,
): OverallStat {
  let income = 0
  let expense = 0
  let wins = 0
  let losses = 0
  let draws = 0
  let best: OverallStat['best'] = null
  let worst: OverallStat['worst'] = null
  const days: { key: string; net: number }[] = []

  for (const [date, money] of moneyByDate) {
    if (date < start || date > end) continue
    if (money.income === 0 && money.expense === 0) continue
    income += money.income
    expense += money.expense
    days.push({ key: date, net: money.net })
    if (money.net > 0) wins += 1
    else if (money.net < 0) losses += 1
    else draws += 1
    if (!best || money.net > best.net) {
      best = { key: date, label: date, net: money.net }
    }
    if (!worst || money.net < worst.net) {
      worst = { key: date, label: date, net: money.net }
    }
  }

  days.sort((a, b) => a.key.localeCompare(b.key))
  let streak = 0
  const last = days[days.length - 1]
  if (last) {
    const sign = last.net > 0 ? 1 : last.net < 0 ? -1 : 0
    if (sign !== 0) {
      for (let i = days.length - 1; i >= 0; i--) {
        const net = days[i].net
        if ((sign > 0 && net > 0) || (sign < 0 && net < 0)) streak += sign
        else break
      }
    }
  }

  const sessions = wins + losses + draws
  const net = income - expense
  return {
    days: sessions,
    wins,
    losses,
    draws,
    winRate: rate(wins, losses, draws),
    income,
    expense,
    net,
    recoveryRate: ratio(income, expense),
    avgNet: sessions ? Math.round(net / sessions) : 0,
    streak,
    best,
    worst,
  }
}

export function weekdayStats(
  moneyByDate: Map<string, DayMoney>,
  start: string,
  end: string,
): WeekdayStat[] {
  const labels = ['日', '月', '火', '水', '木', '金', '土']
  const buckets = labels.map((label, day) => ({
    day,
    label,
    sessions: 0,
    wins: 0,
  }))
  for (const [date, money] of moneyByDate) {
    if (date < start || date > end) continue
    if (money.income === 0 && money.expense === 0) continue
    const dow = getDay(parseISO(date))
    buckets[dow].sessions += 1
    if (money.net > 0) buckets[dow].wins += 1
  }
  return buckets.map((bucket) => ({
    ...bucket,
    winRate: bucket.sessions ? bucket.wins / bucket.sessions : null,
  }))
}

type GroupAcc = {
  key: string
  name: string
  color: string
  sessions: Map<string, { invest: number; recover: number }>
}

function finishGroups(groups: GroupAcc[]): GroupStat[] {
  return groups
    .map((group) => {
      let wins = 0
      let losses = 0
      let draws = 0
      let invest = 0
      let recover = 0
      for (const session of group.sessions.values()) {
        invest += session.invest
        recover += session.recover
        const net = session.recover - session.invest
        if (net > 0) wins += 1
        else if (net < 0) losses += 1
        else draws += 1
      }
      const sessions = group.sessions.size
      const net = recover - invest
      return {
        key: group.key,
        name: group.name,
        color: group.color,
        sessions,
        wins,
        losses,
        draws,
        winRate: rate(wins, losses, draws),
        invest,
        recover,
        net,
        recoveryRate: ratio(recover, invest),
        avgNet: sessions ? Math.round(net / sessions) : 0,
      }
    })
    .filter((group) => group.sessions > 0)
    .sort((a, b) => b.sessions - a.sessions || b.net - a.net)
}

export function groupOfEntry(
  entry: LedgerEntry,
  categories: FinanceCategory[],
  mode: AppMode,
): StatsScope | null {
  const cat = getCategory(categories, entry.categoryId)
  if (!cat) return null
  const ticker = entry.ticker?.trim().toUpperCase()
  if (mode === 'stock' && ticker) {
    return { key: `t:${ticker}`, name: ticker, color: cat.color }
  }
  return { key: `c:${cat.name}`, name: cat.name, color: cat.color }
}

export function usesTradeScopes(mode: AppMode, trades: StockTrade[]): boolean {
  return mode === 'stock' && closedTrades(trades).some((t) => t.netPnl != null)
}

export function statsScopes(
  entries: LedgerEntry[],
  categories: FinanceCategory[],
  mode: AppMode,
  trades: StockTrade[] = [],
): StatsScope[] {
  if (usesTradeScopes(mode, trades)) {
    const seen = new Map<string, StatsScope>()
    let colorIndex = 0
    for (const trade of closedTrades(trades)) {
      const name = (trade.symbolCode || trade.symbolName || '（未設定）').trim()
      const key = `s:${name}`
      if (seen.has(key)) continue
      seen.set(key, {
        key,
        name,
        color: CATEGORY_COLORS[colorIndex++ % CATEGORY_COLORS.length],
      })
    }
    return [...seen.values()]
  }

  const seen = new Map<string, StatsScope>()
  for (const cat of categories) {
    const key = `c:${cat.name}`
    if (seen.has(key)) continue
    seen.set(key, { key, name: cat.name, color: cat.color })
  }
  for (const entry of entries) {
    const group = groupOfEntry(entry, categories, mode)
    if (!group || seen.has(group.key)) continue
    seen.set(group.key, group)
  }
  return [...seen.values()]
}

export function moneyByScope(
  entries: LedgerEntry[],
  categories: FinanceCategory[],
  mode: AppMode,
  scopeKey: string,
): Map<string, DayMoney> {
  const map = new Map<string, DayMoney>()
  for (const entry of entries) {
    const group = groupOfEntry(entry, categories, mode)
    if (!group || group.key !== scopeKey) continue
    const cat = getCategory(categories, entry.categoryId)
    const money = entryMoney(entry, cat)
    const cur = map.get(entry.date) ?? { income: 0, expense: 0, net: 0 }
    cur.income += money.income
    cur.expense += money.expense
    cur.net = cur.income - cur.expense
    map.set(entry.date, cur)
  }
  return map
}

export function moneyByTradeScope(
  trades: StockTrade[],
  scopeKey: string | null,
): Map<string, DayMoney> {
  const map = new Map<string, DayMoney>()
  for (const trade of closedTrades(trades)) {
    const name = (trade.symbolCode || trade.symbolName || '（未設定）').trim()
    const key = `s:${name}`
    if (scopeKey && key !== scopeKey) continue
    const date = trade.exitDate ?? trade.entryDate
    const invest = trade.investedAmount
    const recover = invest + (trade.netPnl ?? 0)
    const cur = map.get(date) ?? { income: 0, expense: 0, net: 0 }
    cur.income += recover
    cur.expense += invest
    cur.net = cur.income - cur.expense
    map.set(date, cur)
  }
  return map
}

export function categoryStats(
  entries: LedgerEntry[],
  categories: FinanceCategory[],
  mode: AppMode,
  start: string,
  end: string,
): GroupStat[] {
  const groups = new Map<string, GroupAcc>()
  for (const entry of entries) {
    if (entry.date < start || entry.date > end) continue
    const group = groupOfEntry(entry, categories, mode)
    if (!group) continue
    const cat = getCategory(categories, entry.categoryId)
    const cur = groups.get(group.key) ?? {
      key: group.key,
      name: group.name,
      color: group.color,
      sessions: new Map(),
    }
    const session = cur.sessions.get(entry.date) ?? { invest: 0, recover: 0 }
    const money = entryMoney(entry, cat)
    session.invest += money.expense
    session.recover += money.income
    cur.sessions.set(entry.date, session)
    groups.set(group.key, cur)
  }
  return finishGroups([...groups.values()])
}

export function tradeStatsBySymbol(
  trades: StockTrade[],
  start: string,
  end: string,
): GroupStat[] {
  const groups = new Map<
    string,
    Omit<GroupStat, 'winRate' | 'recoveryRate' | 'avgNet'>
  >()
  let colorIndex = 0
  for (const trade of closedTrades(trades)) {
    const date = trade.exitDate ?? trade.entryDate
    if (date < start || date > end) continue
    const name = (trade.symbolCode || trade.symbolName || '（未設定）').trim()
    const key = `s:${name}`
    const net = trade.netPnl ?? 0
    const invest = trade.investedAmount
    const cur = groups.get(key) ?? {
      key,
      name,
      color: CATEGORY_COLORS[colorIndex++ % CATEGORY_COLORS.length],
      sessions: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      invest: 0,
      recover: 0,
      net: 0,
    }
    cur.sessions += 1
    cur.invest += invest
    cur.recover += invest + net
    cur.net += net
    if (net > 0) cur.wins += 1
    else if (net < 0) cur.losses += 1
    else cur.draws += 1
    groups.set(key, cur)
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      winRate: rate(group.wins, group.losses, group.draws),
      recoveryRate: ratio(group.recover, group.invest),
      avgNet: group.sessions ? Math.round(group.net / group.sessions) : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions || b.net - a.net)
}

export function shiftAnchor(
  period: StatsPeriod,
  anchor: Date,
  delta: number,
): Date {
  if (period === 'day') return addMonths(anchor, delta)
  if (period === 'month') return addYears(anchor, delta)
  return anchor
}
