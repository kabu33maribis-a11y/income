import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { getLabel } from '../labels'
import type { PlacedStamp, StampLabel } from '../types'

type Props = {
  stamp: PlacedStamp
  labels: StampLabel[]
  selected?: boolean
  copySource?: boolean
  onSelect?: () => void
  onDelete?: () => void
}

export function PlacedStampChip({
  stamp,
  labels,
  selected,
  copySource,
  onSelect,
  onDelete,
}: Props) {
  const label = getLabel(labels, stamp.labelId)
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `placed:${stamp.id}`,
      data: { kind: 'placed', stampId: stamp.id },
    })

  if (!label) return null

  const style = {
    transform: CSS.Translate.toString(transform),
    background: label.color,
    color: label.ink,
    opacity: isDragging ? 0.45 : 1,
  }

  return (
    <button
      type="button"
      ref={setNodeRef}
      className={[
        'stamp-chip',
        selected ? 'is-selected' : '',
        copySource ? 'is-copy-source' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        onDelete?.()
      }}
      aria-label={`${label.name}スタンプ`}
    >
      {label.name}
    </button>
  )
}
