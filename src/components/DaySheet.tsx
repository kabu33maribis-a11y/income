import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useState } from 'react'
import { getCategory } from '../financeCategories'
import { formatYen } from '../finance'
import { MODE_COPY } from '../mode'
import { formatShares, formatSignedYen, RULE_LABELS } from '../stock'
import type { AppMode, FinanceCategory, LedgerEntry, StockTrade } from '../types'
import { LedgerForm } from './LedgerForm'

type Props = {
  mode: AppMode
  dateKey: string
  entries: LedgerEntry[]
  categories: FinanceCategory[]
  dayTrades?: StockTrade[]
  onAdd: (entry: Omit<LedgerEntry, 'id'>) => void
  onUpdate: (entry: LedgerEntry) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export function DaySheet({
  mode,
  dateKey,
  entries,
  categories,
  dayTrades = [],
  onAdd,
  onUpdate,
  onDelete,
  onClose,
}: Props) {
  const title = format(parseISO(dateKey), 'M月d日（E）', { locale: ja })
  const copy = MODE_COPY[mode]
  const [editing, setEditing] = useState<LedgerEntry | null>(null)

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`${title}の${copy.net}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet__header">
          <h2>{title}</h2>
        </header>

        {dayTrades.length > 0 ? (
          <>
            <h3 className="sheet__form-title">この日のトレード</h3>
            <ul className="entry-list">
              {dayTrades.map((t) => (
                <li key={t.id} className="entry-row">
                  <span
                    className="entry-row__dot"
                    style={{
                      background:
                        t.netPnl == null
                          ? '#3d5a80'
                          : t.netPnl >= 0
                            ? '#2f6f6a'
                            : '#c45c3e',
                    }}
                  />
                  <div className="entry-row__body">
                    <strong>
                      {t.symbolCode} {t.entryDate === dateKey ? 'エントリー' : '決済'}
                    </strong>
                    <span className="entry-row__note">
                      {t.side === 'buy' ? '買' : '売'}
                      {t.ruleCompliance ? ` / ${RULE_LABELS[t.ruleCompliance]}` : ''}
                    </span>
                  </div>
                  <span
                    className={[
                      'entry-row__amt',
                      t.netPnl != null && t.netPnl >= 0 ? 'is-income' : '',
                      t.netPnl != null && t.netPnl < 0 ? 'is-expense' : '',
                    ].join(' ')}
                  >
                    {t.netPnl != null
                      ? formatSignedYen(t.netPnl)
                      : formatYen(t.investedAmount)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <ul className="entry-list">
          {entries.length === 0 ? (
            <li className="entry-list__empty">{copy.emptyDay}</li>
          ) : (
            entries.map((e) => {
              const cat = getCategory(categories, e.categoryId)
              if (!cat) return null
              const detail = [
                e.ticker,
                e.shares != null ? `${formatShares(e.shares)}株` : null,
                e.note,
              ]
                .filter(Boolean)
                .join(' · ')
              return (
                <li key={e.id} className="entry-row">
                  <span
                    className="entry-row__dot"
                    style={{ background: cat.color }}
                  />
                  <div className="entry-row__body">
                    <strong>{cat.name}</strong>
                    {detail ? (
                      <span className="entry-row__note">{detail}</span>
                    ) : null}
                  </div>
                  {e.recoverAmount && e.recoverAmount > 0 ? (
                    <span className="entry-row__amts">
                      <span className="entry-row__amt is-expense">
                        -{formatYen(e.amount)}
                      </span>
                      <span className="entry-row__amt is-income">
                        +{formatYen(e.recoverAmount)}
                      </span>
                    </span>
                  ) : (
                    <span
                      className={[
                        'entry-row__amt',
                        cat.kind === 'income' ? 'is-income' : 'is-expense',
                      ].join(' ')}
                    >
                      {cat.kind === 'income' ? '+' : '-'}
                      {formatYen(e.amount)}
                    </span>
                  )}
                  <button
                    type="button"
                    className="entry-row__del"
                    onClick={() => setEditing(e)}
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    className="entry-row__del"
                    onClick={() => onDelete(e.id)}
                  >
                    削除
                  </button>
                </li>
              )
            })
          )}
        </ul>

        {editing ? (
          <h3 className="sheet__form-title">この記録を編集</h3>
        ) : null}
        <LedgerForm
          key={editing?.id ?? `new-${dateKey}`}
          mode={mode}
          categories={categories}
          initialDate={dateKey}
          initial={editing}
          onCancel={editing ? () => setEditing(null) : undefined}
          onSubmit={(entry) => {
            if (entry.id) {
              onUpdate({
                id: entry.id,
                date: entry.date,
                categoryId: entry.categoryId,
                amount: entry.amount,
                recoverAmount: entry.recoverAmount,
                note: entry.note,
                paymentMethod: entry.paymentMethod,
                recurringId: entry.recurringId,
                ticker: entry.ticker,
                shares: entry.shares,
                unitPrice: entry.unitPrice,
              })
              setEditing(null)
            } else {
              onAdd({
                date: entry.date,
                categoryId: entry.categoryId,
                amount: entry.amount,
                recoverAmount: entry.recoverAmount,
                note: entry.note,
                paymentMethod: entry.paymentMethod,
                ticker: entry.ticker,
                shares: entry.shares,
                unitPrice: entry.unitPrice,
              })
            }
          }}
        />
      </div>
    </div>
  )
}
