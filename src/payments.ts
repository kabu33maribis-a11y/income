import type { PaymentMethod } from './types'

export const PAYMENT_METHODS: { id: PaymentMethod; name: string }[] = [
  { id: 'cash', name: '現金' },
  { id: 'credit', name: 'クレジット' },
  { id: 'debit', name: 'デビット' },
  { id: 'emoney', name: '電子マネー' },
  { id: 'transfer', name: '振込' },
  { id: 'broker', name: '証券口座' },
  { id: 'other', name: 'その他' },
]

export const STOCK_PAYMENT_METHODS: { id: PaymentMethod; name: string }[] = [
  { id: 'broker', name: '証券口座' },
  { id: 'transfer', name: '振込' },
  { id: 'other', name: 'その他' },
]

export function paymentLabel(id?: PaymentMethod): string {
  return PAYMENT_METHODS.find((p) => p.id === id)?.name ?? '未設定'
}
