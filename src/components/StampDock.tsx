import type { StampLabel } from '../types'
import { PaletteStamp } from './PaletteStamp'

type Props = {
  labels: StampLabel[]
  copyMode: boolean
  hasSelection: boolean
  onToggleCopy: () => void
  onDeleteSelected: () => void
}

export function StampDock({
  labels,
  copyMode,
  hasSelection,
  onToggleCopy,
  onDeleteSelected,
}: Props) {
  return (
    <footer className="stamp-dock">
      <div className="stamp-dock__actions">
        <button
          type="button"
          className={['dock-btn', copyMode ? 'is-active' : ''].join(' ')}
          onClick={onToggleCopy}
          disabled={!hasSelection && !copyMode}
          aria-pressed={copyMode}
        >
          {copyMode ? 'コピー中… 日付をタップ' : 'コピー'}
        </button>
        <button
          type="button"
          className="dock-btn dock-btn--danger"
          onClick={onDeleteSelected}
          disabled={!hasSelection}
        >
          削除
        </button>
      </div>
      <p className="stamp-dock__hint">
        スタンプをドラッグ／日付タップで収支入力
      </p>
      <div className="stamp-dock__rail" aria-label="スタンプ台紙">
        {labels.map((label) => (
          <PaletteStamp key={label.id} label={label} />
        ))}
      </div>
    </footer>
  )
}
