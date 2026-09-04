import { useState, type FormEvent } from 'react'
import { CATEGORY_COLORS } from '../financeCategories'
import { MODE_COPY } from '../mode'
import type { AppMode, FinanceCategory, LedgerKind } from '../types'

type Props = {
  mode: AppMode
  categories: FinanceCategory[]
  onAdd: (cat: Omit<FinanceCategory, 'id' | 'builtin'>) => void
  onDelete: (id: string) => void
}

export function CategoryManager({ mode, categories, onAdd, onDelete }: Props) {
  const copy = MODE_COPY[mode]
  const [kind, setKind] = useState<LedgerKind>('expense')
  const [name, setName] = useState('')
  const [color, setColor] = useState(CATEGORY_COLORS[0])
  const custom = categories.filter((c) => !c.builtin)
  const builtins = [
    ...new Map(
      categories.filter((c) => c.builtin).map((c) => [c.name, c]),
    ).values(),
  ]

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd({ name: trimmed, kind, color })
    setName('')
  }

  return (
    <section className="chart-card">
      <h3 className="chart-card__title">カテゴリ管理</h3>
      {builtins.length > 0 ? (
        <div className="cat-chip-row" aria-label="標準カテゴリ">
          {builtins.map((c) => (
            <span key={c.id} className="cat-chip">
              <span className="cat-chip__dot" style={{ background: c.color }} />
              {c.name}
            </span>
          ))}
        </div>
      ) : null}
      <form className="ledger-form" onSubmit={handleSubmit}>
        <div className="kind-toggle" role="group" aria-label="カテゴリ種類">
          <button
            type="button"
            className={['kind-toggle__btn', kind === 'expense' ? 'is-active' : ''].join(' ')}
            onClick={() => setKind('expense')}
          >
            {copy.expense}
          </button>
          <button
            type="button"
            className={[
              'kind-toggle__btn is-income',
              kind === 'income' ? 'is-active' : '',
            ].join(' ')}
            onClick={() => setKind('income')}
          >
            {copy.income}
          </button>
        </div>
        <label className="field">
          <span>名前</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={mode === 'stock' ? '例: 積立NISA' : '例: サブスク'}
            maxLength={20}
            required
          />
        </label>
        <div className="color-row" role="listbox" aria-label="色">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={['color-swatch', color === c ? 'is-active' : ''].join(' ')}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={c}
            />
          ))}
        </div>
        <button type="submit" className="dock-btn">
          カテゴリを追加
        </button>
      </form>

      <ul className="entry-list" style={{ marginTop: '0.75rem' }}>
        {custom.length === 0 ? (
          <li className="entry-list__empty">カスタムカテゴリはまだありません</li>
        ) : (
          custom.map((c) => (
            <li key={c.id} className="entry-row">
              <span className="entry-row__dot" style={{ background: c.color }} />
              <div className="entry-row__body">
                <strong>
                  {c.name}
                  <span className="entry-row__note">
                    {c.kind === 'income' ? copy.income : copy.expense}
                  </span>
                </strong>
              </div>
              <button
                type="button"
                className="entry-row__del"
                onClick={() => onDelete(c.id)}
              >
                削除
              </button>
            </li>
          ))
        )}
      </ul>
      <p className="helper-text">
        標準カテゴリ（{builtins.length}個）は固定です
      </p>
    </section>
  )
}
