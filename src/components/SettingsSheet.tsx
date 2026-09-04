import type { AppMode, FinanceCategory } from '../types'
import { CategoryManager } from './CategoryManager'

type Props = {
  mode: AppMode
  categories: FinanceCategory[]
  onAdd: (cat: Omit<FinanceCategory, 'id' | 'builtin'>) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export function SettingsSheet({
  mode,
  categories,
  onAdd,
  onDelete,
  onClose,
}: Props) {
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="sheet sheet--settings"
        role="dialog"
        aria-modal="true"
        aria-label="設定"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet__header">
          <h2>設定</h2>
          <button
            type="button"
            className="sheet__close"
            onClick={onClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </header>
        <p className="helper-text">
          カテゴリは標準項目と、ここで追加するカスタム項目で決まります。追加した項目は家計の入力画面にすぐ出ます。
        </p>
        <CategoryManager
          mode={mode}
          categories={categories}
          onAdd={onAdd}
          onDelete={onDelete}
        />
      </div>
    </div>
  )
}
