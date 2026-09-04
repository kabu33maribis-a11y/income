import { useState, type FormEvent } from 'react'
import { inkForColor, STAMP_COLORS } from '../labels'
import type { StampLabel } from '../types'

type Props = {
  labels: StampLabel[]
  usedCounts: Map<string, number>
  onAdd: (label: Omit<StampLabel, 'id'>) => void
  onUpdate: (id: string, patch: Pick<StampLabel, 'name' | 'color' | 'ink'>) => void
  onDelete: (id: string) => void
}

export function StampManager({
  labels,
  usedCounts,
  onAdd,
  onUpdate,
  onDelete,
}: Props) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(STAMP_COLORS[0])
  const [openId, setOpenId] = useState<string | 'new' | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd({ name: trimmed, color, ink: inkForColor(color) })
    setName('')
    setOpenId(null)
  }

  function commitName(label: StampLabel, next: string) {
    const trimmed = next.trim()
    onUpdate(label.id, {
      name: trimmed || 'スタンプ',
      color: label.color,
      ink: label.ink,
    })
  }

  return (
    <section className="stamp-manager">
      <p className="stamp-manager__hint">名前・色の編集、追加と削除</p>

      <ul className="stamp-manager__list">
        {labels.map((label) => {
          const used = usedCounts.get(label.id) ?? 0
          const open = openId === label.id
          return (
            <li key={label.id} className="stamp-edit">
              <div className="stamp-edit__row">
                <button
                  type="button"
                  className={['stamp-edit__dot', open ? 'is-open' : ''].join(
                    ' ',
                  )}
                  style={{ background: label.color }}
                  onClick={() => setOpenId(open ? null : label.id)}
                  aria-label={`${label.name}の色`}
                  aria-expanded={open}
                />
                <input
                  className="stamp-edit__name"
                  value={label.name}
                  onChange={(e) => {
                    onUpdate(label.id, {
                      name: e.target.value.slice(0, 8),
                      color: label.color,
                      ink: label.ink,
                    })
                  }}
                  onBlur={(e) => commitName(label, e.target.value)}
                  maxLength={8}
                  aria-label={`${label.name}のラベル`}
                />
                <button
                  type="button"
                  className="stamp-edit__del"
                  onClick={() => {
                    if (labels.length <= 1) {
                      alert('スタンプは1つ以上残してください')
                      return
                    }
                    const msg =
                      used > 0
                        ? `「${label.name}」はカレンダーに${used}個あります。削除しますか？`
                        : `「${label.name}」を削除しますか？`
                    if (!confirm(msg)) return
                    onDelete(label.id)
                  }}
                >
                  削除
                </button>
              </div>
              {open ? (
                <ColorRow
                  value={label.color}
                  name={label.name}
                  onChange={(c) =>
                    onUpdate(label.id, {
                      name: label.name,
                      color: c,
                      ink: inkForColor(c),
                    })
                  }
                />
              ) : null}
            </li>
          )
        })}
      </ul>

      <form className="stamp-add" onSubmit={handleSubmit}>
        <div className="stamp-edit__row">
          <button
            type="button"
            className={[
              'stamp-edit__dot',
              openId === 'new' ? 'is-open' : '',
            ].join(' ')}
            style={{ background: color }}
            onClick={() => setOpenId(openId === 'new' ? null : 'new')}
            aria-label="新しい色"
            aria-expanded={openId === 'new'}
          />
          <input
            className="stamp-edit__name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="新しいラベル"
            maxLength={8}
            required
            aria-label="新しいラベル"
          />
          <button type="submit" className="stamp-add__btn">
            追加
          </button>
        </div>
        {openId === 'new' ? (
          <ColorRow value={color} name="新しいスタンプ" onChange={setColor} />
        ) : null}
      </form>
    </section>
  )
}

function ColorRow({
  value,
  name,
  onChange,
}: {
  value: string
  name: string
  onChange: (color: string) => void
}) {
  return (
    <div className="color-row color-row--compact" role="listbox" aria-label={`${name}の色`}>
      {STAMP_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className={['color-swatch', value === c ? 'is-active' : ''].join(' ')}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={c}
        />
      ))}
      <label className="color-swatch color-swatch--custom">
        <span className="sr-only">任意の色</span>
        <input
          type="color"
          value={toColorInput(value)}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${name}の任意色`}
        />
      </label>
    </div>
  )
}

function toColorInput(hex: string): string {
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#2f6f6a'
}
