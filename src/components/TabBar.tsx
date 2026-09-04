import { ModeSwitch } from './ModeSwitch'
import type { SyncStatus } from '../cloud'
import type { AppMode } from '../types'

const SYNC_LABEL: Record<SyncStatus, string> = {
  loading: '記録を読み込み中',
  saving: 'クラウドに保存中',
  saved: '記録はクラウドに保存',
  local: '記録はこの端末に保存',
  error: 'クラウド保存に失敗。この端末には残っています',
}

type Props = {
  mode: AppMode
  onModeChange: (mode: AppMode) => void
  sync: SyncStatus
  statsOpen: boolean
  onOpenStats: () => void
  settingsOpen: boolean
  onOpenSettings: () => void
}

export function TabBar({
  mode,
  onModeChange,
  sync,
  statsOpen,
  onOpenStats,
  settingsOpen,
  onOpenSettings,
}: Props) {
  return (
    <div className="chrome">
      <div className="chrome__row">
        <div className="chrome__nav">
          <ModeSwitch mode={mode} onChange={onModeChange} />
        </div>
        <div className="chrome__tools">
          <button
            type="button"
            className={['chrome__gear', statsOpen ? 'is-active' : ''].join(' ')}
            onClick={onOpenStats}
            aria-label="統計"
            aria-pressed={statsOpen}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M4 19h16v2H4zm1.5-3.2h2.2V9.4H5.5zm5.4 0h2.2V5H10.9zm5.4 0H18.5v-6.4h-2.2z"
              />
            </svg>
          </button>
          <button
            type="button"
            className={['chrome__gear', settingsOpen ? 'is-active' : ''].join(' ')}
            onClick={onOpenSettings}
            aria-label="設定"
            aria-pressed={settingsOpen}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96c-.5-.4-1.04-.72-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.59.22-1.13.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.81 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.93 14.16a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.39-.96c.5.4 1.04.72 1.63.94l.36 2.54c.05.24.25.42.49.42h3.8c.24 0 .44-.18.49-.42l.36-2.54c.59-.22 1.13-.54 1.63-.94l2.39.96c.24.1.51 0 .64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
              />
            </svg>
          </button>
        </div>
      </div>
      {sync !== 'saved' && (
        <p className={['sync-status', `is-${sync}`].join(' ')}>{SYNC_LABEL[sync]}</p>
      )}
    </div>
  )
}
