import { useState } from 'react'
import { addMonths, format, subMonths } from 'date-fns'
import { ja } from 'date-fns/locale'
import {
  budgetProgress,
  dailyBars,
  downloadText,
  formatYen,
  monthlyTrends,
  summarizeMonth,
  totalsByCategory,
} from '../finance'
import { MODE_COPY } from '../mode'
import { analyzeStock } from '../stock'
import type {
  AppMode,
  AppSnapshot,
  CategoryBudget,
  FinanceCategory,
  LedgerEntry,
  StockEvalState,
} from '../types'
import { CategoryManager } from './CategoryManager'
import { DailyBarsChart } from './DailyBarsChart'
import { HoldingsCard } from './HoldingsCard'
import { MonthTrendChart } from './MonthTrendChart'
import { StockPanel } from './StockPanel'
import { YearSummary } from './YearSummary'

type Props = {
  mode: AppMode
  month: Date
  onMonthChange: (d: Date) => void
  entries: LedgerEntry[]
  categories: FinanceCategory[]
  budgets: CategoryBudget[]
  stockEval?: StockEvalState
  onStockEvalChange?: (state: StockEvalState) => void
  onAddCategory: (cat: Omit<FinanceCategory, 'id' | 'builtin'>) => void
  onDeleteCategory: (id: string) => void
  onResetFinance: () => void
  onExport: () => AppSnapshot
  onImport: (raw: unknown) => boolean
}

export function FinancePanel({
  mode,
  month,
  onMonthChange,
  entries,
  categories,
  budgets,
  stockEval,
  onStockEvalChange,
  onAddCategory,
  onDeleteCategory,
  onResetFinance,
  onExport,
  onImport,
}: Props) {
  const copy = MODE_COPY[mode]
  const [summaryYear, setSummaryYear] = useState(() => month.getFullYear())

  const summary = summarizeMonth(entries, month, categories)
  const prevSummary = summarizeMonth(entries, subMonths(month, 1), categories)
  const expenseDelta = summary.expense - prevSummary.expense
  const netDelta = summary.net - prevSummary.net
  const budgetRemain = budgets.reduce((sum, b) => {
    const spent =
      budgetProgress(entries, month, [b], categories)[0]?.spent ?? 0
    return sum + Math.max(b.limit - spent, 0)
  }, 0)

  const expenseCats = totalsByCategory(entries, month, 'expense', categories)
  const bars = dailyBars(entries, month, categories)
  const trends = monthlyTrends(entries, categories, month, 6)
  const topExpense = expenseCats[0]
  const stock = mode === 'stock' ? analyzeStock(entries, categories, month) : null

  return (
    <section className="finance-panel">
      {mode === 'stock' && stockEval && onStockEvalChange ? (
        <StockPanel state={stockEval} onChange={onStockEvalChange} />
      ) : null}

      <header className="month-header">
        <button
          type="button"
          className="nav-btn"
          onClick={() => onMonthChange(subMonths(month, 1))}
          aria-label="前月"
        >
          ‹
        </button>
        <h1 className="month-title">
          {format(month, 'yyyy年 M月', { locale: ja })}
        </h1>
        <button
          type="button"
          className="nav-btn"
          onClick={() => onMonthChange(addMonths(month, 1))}
          aria-label="翌月"
        >
          ›
        </button>
      </header>

      <div className="summary-grid">
        <div className="summary-card is-income">
          <span>{copy.income}</span>
          <strong>{formatYen(summary.income)}</strong>
        </div>
        <div className="summary-card is-expense">
          <span>{copy.expense}</span>
          <strong>{formatYen(summary.expense)}</strong>
        </div>
        <div
          className={[
            'summary-card is-net',
            summary.net >= 0 ? 'is-plus' : 'is-minus',
          ].join(' ')}
        >
          <span>{copy.net}</span>
          <strong>
            {summary.net > 0 ? '+' : ''}
            {formatYen(summary.net)}
          </strong>
          <em className="summary-card__delta">
            前月比 {copy.expense} {deltaText(expenseDelta)} / {copy.net}{' '}
            {deltaText(netDelta)}
          </em>
          {stock ? (
            <>
              <em className="summary-card__delta">
                今月の実現損益 {deltaText(Math.round(stock.month.realized))}
                {stock.month.dividends > 0
                  ? ` / 配当 ${formatYen(stock.month.dividends)}`
                  : ''}
              </em>
              {stock.month.fees > 0 ? (
                <em className="summary-card__delta">
                  手数料 {formatYen(stock.month.fees)}
                </em>
              ) : null}
            </>
          ) : null}
          {budgets.length > 0 ? (
            <em className="summary-card__delta">
              予算のこり合計 {formatYen(budgetRemain)}
            </em>
          ) : null}
          {topExpense ? (
            <em className="summary-card__delta">
              最大{copy.expense}: {topExpense.category.name}{' '}
              {formatYen(topExpense.total)}
            </em>
          ) : null}
        </div>
      </div>

      {stock ? <HoldingsCard holdings={stock.holdings} /> : null}

      <YearSummary
        year={summaryYear}
        entries={entries}
        categories={categories}
        copy={copy}
        onYearChange={setSummaryYear}
      />
      <MonthTrendChart trends={trends} copy={copy} />
      <DailyBarsChart bars={bars} copy={copy} />

      <CategoryManager
        mode={mode}
        categories={categories}
        onAdd={onAddCategory}
        onDelete={onDeleteCategory}
      />
      <section className="chart-card">
        <h3 className="chart-card__title">データの保存</h3>
        <p className="helper-text">
          記録はクラウドとこの端末の両方に残します。引っ越し用のバックアップも出せます。
        </p>
        <div className="backup-actions">
          <button
            type="button"
            className="dock-btn"
            onClick={() => {
              const snap = onExport()
              downloadText(
                `shuushi-${snap.updatedAt.slice(0, 10)}.json`,
                JSON.stringify(snap, null, 2),
                'application/json',
              )
            }}
          >
            バックアップを書き出す
          </button>
          <label className="dock-btn backup-import">
            バックアップを読み込む
            <input
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                try {
                  const raw: unknown = JSON.parse(await file.text())
                  if (!onImport(raw)) {
                    window.alert('このファイルは読み込めませんでした')
                  }
                } catch {
                  window.alert('このファイルは読み込めませんでした')
                }
              }}
            />
          </label>
        </div>
        <p className="helper-text">{copy.resetHint}</p>
        <button
          type="button"
          className="dock-btn dock-btn--danger"
          onClick={() => {
            if (
              window.confirm(
                `${copy.name}モードのデータをすべて削除します。よろしいですか？`,
              )
            ) {
              onResetFinance()
            }
          }}
        >
          このモードのデータを消す
        </button>
      </section>
    </section>
  )
}

function deltaText(n: number): string {
  if (n === 0) return '±0'
  const sign = n > 0 ? '+' : ''
  return `${sign}${formatYen(n)}`
}
