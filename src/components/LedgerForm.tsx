import { useEffect, useState, type FormEvent } from 'react'
import { categoriesByKind } from '../financeCategories'
import type {
  AppMode,
  FinanceCategory,
  LedgerEntry,
  LedgerKind,
} from '../types'

type Props = {
  mode?: AppMode
  categories: FinanceCategory[]
  initialDate: string
  initial?: LedgerEntry | null
  onSubmit: (entry: Omit<LedgerEntry, 'id'> & { id?: string }) => void
  onCancel?: () => void
  submitLabel?: string
}

function parseYen(raw: string): number {
  const value = Number(raw.replace(/,/g, ''))
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0
}

function categoryNames(categories: FinanceCategory[]): string[] {
  const seen = new Set<string>()
  const names: string[] = []
  for (const c of categories) {
    if (seen.has(c.name)) continue
    seen.add(c.name)
    names.push(c.name)
  }
  return names
}

function resolveCategory(
  categories: FinanceCategory[],
  kind: LedgerKind,
  name: string,
): FinanceCategory | undefined {
  return (
    categories.find((c) => c.kind === kind && c.name === name) ??
    categoriesByKind(categories, kind)[0]
  )
}

function amountsFromEntry(
  entry: LedgerEntry | null | undefined,
  cat: FinanceCategory | undefined,
): { invest: string; recover: string } {
  if (!entry) return { invest: '', recover: '' }
  if (entry.recoverAmount && entry.recoverAmount > 0) {
    return { invest: String(entry.amount), recover: String(entry.recoverAmount) }
  }
  if (cat?.kind === 'income') return { invest: '', recover: String(entry.amount) }
  return { invest: String(entry.amount), recover: '' }
}

export function LedgerForm({
  mode = 'private',
  categories,
  initialDate,
  initial = null,
  onSubmit,
  onCancel,
  submitLabel,
}: Props) {
  const initialCat = initial
    ? categories.find((c) => c.id === initial.categoryId)
    : undefined
  const names = categoryNames(categories)
  const [categoryName, setCategoryName] = useState(
    initialCat?.name ?? names[0] ?? '',
  )
  const date = initial?.date ?? initialDate
  const [investAmount, setInvestAmount] = useState(
    amountsFromEntry(initial, initialCat).invest,
  )
  const [recoverAmount, setRecoverAmount] = useState(
    amountsFromEntry(initial, initialCat).recover,
  )
  const [ticker, setTicker] = useState(initial?.ticker ?? '')
  const [shares, setShares] = useState(
    initial?.shares != null ? String(initial.shares) : '',
  )
  const [unitPrice, setUnitPrice] = useState(
    initial?.unitPrice != null ? String(initial.unitPrice) : '',
  )

  useEffect(() => {
    if (initial) {
      const cat = categories.find((c) => c.id === initial.categoryId)
      const amounts = amountsFromEntry(initial, cat)
      setCategoryName(cat?.name ?? categoryNames(categories)[0] ?? '')
      setInvestAmount(amounts.invest)
      setRecoverAmount(amounts.recover)
      setTicker(initial.ticker ?? '')
      setShares(initial.shares != null ? String(initial.shares) : '')
      setUnitPrice(initial.unitPrice != null ? String(initial.unitPrice) : '')
    }
  }, [initial, categories, mode])

  useEffect(() => {
    if (mode !== 'stock' || initial) return
    const s = Number(shares.replace(/,/g, ''))
    const p = Number(unitPrice.replace(/,/g, ''))
    if (s > 0 && p > 0) setInvestAmount(String(Math.round(s * p)))
  }, [shares, unitPrice, mode, initial])

  function emit(
    kind: LedgerKind,
    amount: number,
    id?: string,
    recover?: number,
  ) {
    const cat = resolveCategory(categories, kind, categoryName)
    if (!cat) return
    const shareVal = Number(shares.replace(/,/g, ''))
    const priceVal = Number(unitPrice.replace(/,/g, ''))
    onSubmit({
      id,
      date,
      categoryId: cat.id,
      amount,
      recoverAmount: recover && recover > 0 ? recover : undefined,
      note: initial?.note ?? '',
      paymentMethod:
        initial?.paymentMethod ?? (mode === 'stock' ? 'broker' : 'cash'),
      recurringId: initial?.recurringId,
      ticker: ticker.trim() || undefined,
      shares: Number.isFinite(shareVal) && shareVal > 0 ? shareVal : undefined,
      unitPrice:
        Number.isFinite(priceVal) && priceVal > 0 ? priceVal : undefined,
    })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const invest = parseYen(investAmount)
    const recover = parseYen(recoverAmount)
    if ((!invest && !recover) || !categoryName || !date) return

    if (invest && recover) emit('expense', invest, initial?.id, recover)
    else if (invest) emit('expense', invest, initial?.id)
    else emit('income', recover, initial?.id)

    if (!initial) {
      setInvestAmount('')
      setRecoverAmount('')
      setShares('')
      setUnitPrice('')
    }
  }

  return (
    <form className="ledger-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>カテゴリ</span>
        <select
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          required
        >
          {names.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>

      {mode === 'stock' ? (
        <>
          <label className="field">
            <span>銘柄コード</span>
            <input
              type="text"
              placeholder="例: 7203 / AAPL"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              maxLength={16}
              autoCapitalize="characters"
            />
          </label>
          <div className="field-row">
            <label className="field">
              <span>株数</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="例: 100"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
              />
            </label>
            <label className="field">
              <span>単価</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="例: 2150"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </label>
          </div>
        </>
      ) : null}

      <div className="amount-pair" role="group" aria-label="金額">
        <label
          className={[
            'amount-box is-invest',
            investAmount ? 'is-active' : '',
          ].join(' ')}
        >
          <span className="amount-box__label">投資</span>
          <span className="amount-box__input">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              placeholder=""
              value={investAmount}
              onChange={(e) => setInvestAmount(e.target.value)}
            />
            <span className="amount-box__yen" aria-hidden="true">
              円
            </span>
          </span>
        </label>
        <label
          className={[
            'amount-box is-recover',
            recoverAmount ? 'is-active' : '',
          ].join(' ')}
        >
          <span className="amount-box__label">回収</span>
          <span className="amount-box__input">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              placeholder=""
              value={recoverAmount}
              onChange={(e) => setRecoverAmount(e.target.value)}
            />
            <span className="amount-box__yen" aria-hidden="true">
              円
            </span>
          </span>
        </label>
      </div>

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
          {submitLabel ?? (initial ? '更新' : '追加')}
        </button>
      </div>
    </form>
  )
}
