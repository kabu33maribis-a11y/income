import type { AppMode } from './types'

export type ModeCopy = {
  name: string
  income: string
  expense: string
  net: string
  yearIncome: string
  yearExpense: string
  yearNet: string
  yearAvg: string
  addTitle: string
  dailyTitle: string
  resetHint: string
  emptyDay: string
}

export const MODE_COPY: Record<AppMode, ModeCopy> = {
  private: {
    name: 'プライベート',
    income: '収入',
    expense: '支出',
    net: '収支',
    yearIncome: '年収合計',
    yearExpense: '年支出合計',
    yearNet: '年間収支',
    yearAvg: '平均支出',
    addTitle: '記録を追加',
    dailyTitle: '日別の収支',
    resetHint: 'このモードの収支・予算・繰り返し・目標だけを消します。',
    emptyDay: 'この日の収支はまだありません',
  },
  stock: {
    name: '株',
    income: '入金',
    expense: '出金',
    net: 'キャッシュフロー',
    yearIncome: '年入金合計',
    yearExpense: '年出金合計',
    yearNet: '年間キャッシュフロー',
    yearAvg: '平均出金',
    addTitle: '取引を追加',
    dailyTitle: '日別のキャッシュフロー',
    resetHint: '株モードの取引・予算・繰り返し・目標だけを消します。',
    emptyDay: 'この日の取引はまだありません',
  },
}

export function isAppMode(v: unknown): v is AppMode {
  return v === 'private' || v === 'stock'
}
