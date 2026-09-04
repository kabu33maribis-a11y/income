import type { AppMode } from '../types'

type Props = {
  mode: AppMode
  onChange: (mode: AppMode) => void
}

export function ModeSwitch({ mode, onChange }: Props) {
  return (
    <div className="mode-bar" role="tablist" aria-label="モード">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'private'}
        className={[
          'mode-bar__btn',
          mode === 'private' ? 'is-active' : '',
        ].join(' ')}
        onClick={() => onChange('private')}
      >
        プライベート
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'stock'}
        className={[
          'mode-bar__btn is-stock',
          mode === 'stock' ? 'is-active' : '',
        ].join(' ')}
        onClick={() => onChange('stock')}
      >
        株
      </button>
    </div>
  )
}
