import type { AppMode, FinanceCategory } from './types'

const GAME_CATEGORIES = [
  { slug: 'poker', name: 'ポーカー', color: '#3d5a80' },
  { slug: 'dobon', name: 'ドボン', color: '#d18a2c' },
  { slug: 'slot', name: 'スロット', color: '#7a5c8a' },
  { slug: 'pachinko', name: 'パチンコ', color: '#c45c3e' },
] as const

export const BUILTIN_CATEGORIES: FinanceCategory[] = GAME_CATEGORIES.flatMap(
  (game) => [
    {
      id: game.slug,
      name: game.name,
      kind: 'expense' as const,
      color: game.color,
      builtin: true,
    },
    {
      id: `${game.slug}-in`,
      name: game.name,
      kind: 'income' as const,
      color: game.color,
      builtin: true,
    },
  ],
)

export const STOCK_CATEGORIES: FinanceCategory[] = [
  { id: 'stock-sell', name: '売却', kind: 'income', color: '#2f6f6a', builtin: true },
  { id: 'stock-div', name: '配当', kind: 'income', color: '#3d8a72', builtin: true },
  { id: 'stock-other-in', name: 'その他入金', kind: 'income', color: '#6b9e8f', builtin: true },
  { id: 'stock-buy', name: '購入', kind: 'expense', color: '#3d5a80', builtin: true },
  { id: 'stock-fee', name: '手数料', kind: 'expense', color: '#8a6d3b', builtin: true },
  { id: 'stock-other-out', name: 'その他出金', kind: 'expense', color: '#8a5a5a', builtin: true },
]

export const CATEGORY_COLORS = [
  '#2f6f6a',
  '#c45c3e',
  '#3d5a80',
  '#d18a2c',
  '#7a5c8a',
  '#6b7c3d',
  '#8a5a5a',
  '#2d8a6e',
  '#8a6d3b',
  '#4a6fa5',
]

export function getCategory(
  categories: FinanceCategory[],
  id: string,
): FinanceCategory | undefined {
  return categories.find((c) => c.id === id)
}

export function categoriesByKind(
  categories: FinanceCategory[],
  kind: FinanceCategory['kind'],
): FinanceCategory[] {
  return categories.filter((c) => c.kind === kind)
}

export function builtinsFor(mode: AppMode): FinanceCategory[] {
  return mode === 'stock' ? STOCK_CATEGORIES : BUILTIN_CATEGORIES
}

export function mergeCategories(
  custom: FinanceCategory[],
  mode: AppMode = 'private',
): FinanceCategory[] {
  const customIds = new Set(custom.map((c) => c.id))
  const builtins = builtinsFor(mode).filter((c) => !customIds.has(c.id))
  return [...builtins, ...custom.filter((c) => !c.builtin)]
}
