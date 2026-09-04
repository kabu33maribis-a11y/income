import { useEffect, useMemo, useState } from 'react'
import { DaySheet } from './components/DaySheet'
import { MonthGrid } from './components/MonthGrid'
import { SettingsSheet } from './components/SettingsSheet'
import { StatsSheet } from './components/StatsSheet'
import { TabBar } from './components/TabBar'
import { hydrateApp, queueCloudSave, type SyncStatus } from './cloud'
import { materializeRecurring, moneyByDate } from './finance'
import {
  loadAllCategories,
  loadBudgets,
  loadGoals,
  loadLedger,
  loadMode,
  loadRecurring,
  loadStockEval,
  newId,
  saveBudgets,
  saveCustomCategories,
  saveGoals,
  saveLedger,
  saveMode,
  saveRecurring,
  saveStockEval,
} from './storage'
import { stockMoneyByDate } from './stock'
import type {
  AppMode,
  AppSnapshot,
  CategoryBudget,
  DayMoney,
  FinanceCategory,
  LedgerEntry,
  RecurringRule,
  SavingsGoal,
  StockEvalState,
} from './types'
import './App.css'

export default function App() {
  const [mode, setMode] = useState<AppMode>(() => loadMode())
  const [month, setMonth] = useState(() => new Date())
  const [ledger, setLedger] = useState<LedgerEntry[]>(() => loadLedger(loadMode()))
  const [categories, setCategories] = useState<FinanceCategory[]>(() =>
    loadAllCategories(loadMode()),
  )
  const [budgets, setBudgets] = useState<CategoryBudget[]>(() =>
    loadBudgets(loadMode()),
  )
  const [recurring, setRecurring] = useState<RecurringRule[]>(() =>
    loadRecurring(loadMode()),
  )
  const [goals, setGoals] = useState<SavingsGoal[]>(() => loadGoals(loadMode()))
  const [stockEval, setStockEval] = useState<StockEvalState>(() => loadStockEval())
  const [daySheetDate, setDaySheetDate] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [sync, setSync] = useState<SyncStatus>('loading')

  function applySnapshot(snap: AppSnapshot) {
    setMode(snap.mode)
    setLedger(loadLedger(snap.mode))
    setCategories(loadAllCategories(snap.mode))
    setBudgets(loadBudgets(snap.mode))
    setRecurring(loadRecurring(snap.mode))
    setGoals(loadGoals(snap.mode))
    setStockEval(loadStockEval())
  }

  useEffect(() => {
    let cancelled = false
    void hydrateApp().then((result) => {
      if (cancelled) return
      applySnapshot(result.snapshot)
      setReady(true)
      setSync(result.source === 'local' ? 'local' : 'saved')
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    saveMode(mode)
    queueCloudSave(setSync)
  }, [mode, ready])

  useEffect(() => {
    if (!ready) return
    saveLedger(ledger, mode)
    queueCloudSave(setSync)
  }, [ledger, mode, ready])

  useEffect(() => {
    if (!ready) return
    saveCustomCategories(
      categories.filter((c) => !c.builtin),
      mode,
    )
    queueCloudSave(setSync)
  }, [categories, mode, ready])

  useEffect(() => {
    if (!ready) return
    saveBudgets(budgets, mode)
    queueCloudSave(setSync)
  }, [budgets, mode, ready])

  useEffect(() => {
    if (!ready) return
    saveRecurring(recurring, mode)
    queueCloudSave(setSync)
  }, [recurring, mode, ready])

  useEffect(() => {
    if (!ready) return
    saveGoals(goals, mode)
    queueCloudSave(setSync)
  }, [goals, mode, ready])

  useEffect(() => {
    if (!ready) return
    saveStockEval(stockEval)
    queueCloudSave(setSync)
  }, [stockEval, ready])

  useEffect(() => {
    if (!ready) return
    setLedger((prev) => {
      const added = materializeRecurring(prev, recurring, month)
      if (added.length === 0) return prev
      const ids = new Set(prev.map((e) => e.id))
      const unique = added.filter((a) => !ids.has(a.id))
      if (unique.length === 0) return prev
      return [...prev, ...unique]
    })
  }, [month, recurring, ready])

  const moneyMap = useMemo(() => {
    const ledgerMap = moneyByDate(ledger, categories)
    if (mode !== 'stock') return ledgerMap
    return mergeMoney(ledgerMap, stockMoneyByDate(stockEval.trades, stockEval.flows))
  }, [ledger, categories, mode, stockEval.trades, stockEval.flows])

  const daySheetEntries = daySheetDate
    ? ledger.filter((e) => e.date === daySheetDate)
    : []

  function switchMode(next: AppMode) {
    if (next === mode) return
    setMode(next)
    setLedger(loadLedger(next))
    setCategories(loadAllCategories(next))
    setBudgets(loadBudgets(next))
    setRecurring(loadRecurring(next))
    setGoals(loadGoals(next))
    setDaySheetDate(null)
    setSettingsOpen(false)
    setStatsOpen(false)
  }

  function addLedger(entry: Omit<LedgerEntry, 'id'>) {
    setLedger((prev) => [...prev, { ...entry, id: newId() }])
  }

  function updateLedger(entry: LedgerEntry) {
    setLedger((prev) => prev.map((e) => (e.id === entry.id ? entry : e)))
  }

  function deleteLedger(id: string) {
    setLedger((prev) => prev.filter((e) => e.id !== id))
  }

  function addCategory(cat: Omit<FinanceCategory, 'id' | 'builtin'>) {
    setCategories((prev) => [...prev, { ...cat, id: newId(), builtin: false }])
  }

  function deleteCategory(id: string) {
    setCategories((prev) => prev.filter((c) => c.id !== id))
    setBudgets((prev) => prev.filter((b) => b.categoryId !== id))
  }

  return (
    <div
      className={[
        'app-shell',
        mode === 'stock' ? 'is-stock' : 'is-private',
        'is-month',
      ].join(' ')}
    >
      <TabBar
        mode={mode}
        onModeChange={switchMode}
        sync={sync}
        statsOpen={statsOpen}
        onOpenStats={() => {
          setDaySheetDate(null)
          setSettingsOpen(false)
          setStatsOpen(true)
        }}
        settingsOpen={settingsOpen}
        onOpenSettings={() => {
          setDaySheetDate(null)
          setStatsOpen(false)
          setSettingsOpen(true)
        }}
      />

      <MonthGrid
        month={month}
        onMonthChange={setMonth}
        moneyByDate={moneyMap}
        onDayTap={setDaySheetDate}
      />

      {statsOpen ? (
        <StatsSheet
          mode={mode}
          month={month}
          onMonthChange={setMonth}
          moneyByDate={moneyMap}
          entries={ledger}
          categories={categories}
          trades={mode === 'stock' ? stockEval.trades : []}
          onClose={() => setStatsOpen(false)}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsSheet
          mode={mode}
          categories={categories}
          onAdd={addCategory}
          onDelete={deleteCategory}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      {daySheetDate ? (
        <DaySheet
          mode={mode}
          dateKey={daySheetDate}
          entries={daySheetEntries}
          categories={categories}
          dayTrades={
            mode === 'stock'
              ? stockEval.trades.filter(
                  (t) =>
                    t.entryDate === daySheetDate || t.exitDate === daySheetDate,
                )
              : []
          }
          onAdd={addLedger}
          onUpdate={updateLedger}
          onDelete={deleteLedger}
          onClose={() => setDaySheetDate(null)}
        />
      ) : null}
    </div>
  )
}

function mergeMoney(
  a: Map<string, DayMoney>,
  b: Map<string, DayMoney>,
): Map<string, DayMoney> {
  const map = new Map(a)
  for (const [key, value] of b) {
    const cur = map.get(key) ?? { income: 0, expense: 0, net: 0 }
    const income = cur.income + value.income
    const expense = cur.expense + value.expense
    map.set(key, { income, expense, net: income - expense })
  }
  return map
}
