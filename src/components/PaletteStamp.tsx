import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { StampLabel } from '../types'

type Props = {
  label: StampLabel
}

export function PaletteStamp({ label }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `palette:${label.id}`,
      data: { kind: 'palette', labelId: label.id },
    })

  const style = {
    transform: CSS.Translate.toString(transform),
    background: label.color,
    color: label.ink,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <button
      type="button"
      ref={setNodeRef}
      className="palette-stamp"
      style={style}
      {...listeners}
      {...attributes}
      aria-label={`${label.name}をドラッグ`}
    >
      <span className="palette-stamp__mark" aria-hidden>
        ●
      </span>
      {label.name}
    </button>
  )
}
