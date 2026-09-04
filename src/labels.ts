import type { StampLabel } from './types'

/** あらかじめ決めたラベル（スタンプ台紙） */
export const DEFAULT_STAMP_LABELS: StampLabel[] = [
  { id: 'work', name: '仕事', color: '#2f6f6a', ink: '#e8f4f2' },
  { id: 'private', name: '私用', color: '#c45c3e', ink: '#fff0eb' },
  { id: 'meet', name: '打合せ', color: '#3d5a80', ink: '#eef3f8' },
  { id: 'trip', name: '外出', color: '#6b7c3d', ink: '#f3f6e8' },
  { id: 'study', name: '勉強', color: '#7a5c8a', ink: '#f5eef8' },
  { id: 'health', name: '健康', color: '#2d8a6e', ink: '#e8f7f1' },
  { id: 'deadline', name: '締切', color: '#b33a3a', ink: '#fdeeee' },
  { id: 'fun', name: '遊び', color: '#d18a2c', ink: '#fff6e8' },
]

export const STAMP_COLORS = [
  '#2f6f6a',
  '#c45c3e',
  '#3d5a80',
  '#6b7c3d',
  '#7a5c8a',
  '#2d8a6e',
  '#b33a3a',
  '#d18a2c',
  '#4a6fa5',
  '#8a6d3b',
  '#6b5b4a',
  '#8a5a5a',
]

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = Number.parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** スタンプ背景に合わせた薄いインク色 */
export function inkForColor(hex: string): string {
  const rgb = parseHex(hex)
  if (!rgb) return '#f4faf7'
  const mix = (c: number) => Math.round(c * 0.14 + 255 * 0.86)
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(mix(rgb.r))}${toHex(mix(rgb.g))}${toHex(mix(rgb.b))}`
}

export function withInk(label: Omit<StampLabel, 'ink'> & { ink?: string }): StampLabel {
  return {
    ...label,
    ink: label.ink || inkForColor(label.color),
  }
}

export function getLabel(
  labels: StampLabel[],
  id: string,
): StampLabel | undefined {
  return labels.find((l) => l.id === id)
}

export function isStampLabel(v: unknown): v is StampLabel {
  if (!v || typeof v !== 'object') return false
  const l = v as StampLabel
  return (
    typeof l.id === 'string' &&
    l.id.length > 0 &&
    typeof l.name === 'string' &&
    l.name.trim().length > 0 &&
    typeof l.color === 'string' &&
    typeof l.ink === 'string'
  )
}
