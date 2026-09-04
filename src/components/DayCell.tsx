import { format, isSameMonth, isToday } from 'date-fns'
import { formatYen } from '../finance'
import type { DayMoney } from '../types'

type Props = {
  date: Date
  currentMonth: Date
  money?: DayMoney
  onDayTap: (dateKey: string) => void
}

export function DayCell({ date, currentMonth, money, onDayTap }: Props) {
  const dateKey = format(date, 'yyyy-MM-dd')
  const outside = !isSameMonth(date, currentMonth)
  const today = isToday(date)
  const hasMoney = Boolean(money && (money.income > 0 || money.expense > 0))
  const net = money?.net ?? 0
  const netClass = net > 0 ? 'is-income' : net < 0 ? 'is-expense' : 'is-zero'

  return (
    <button
      type="button"
      className={[
        'day-cell',
        outside ? 'is-outside' : '',
        today ? 'is-today' : '',
        hasMoney ? 'has-money' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onDayTap(dateKey)}
      aria-label={
        hasMoney
          ? `${format(date, 'M月d日')} 差額 ${formatYen(net)}`
          : `${format(date, 'M月d日')}`
      }
    >
      <span className="day-cell__num">{format(date, 'd')}</span>
      {hasMoney ? (
        <div className="day-cell__money" aria-hidden>
          <span className={netClass}>{signedCompactYen(net)}</span>
        </div>
      ) : null}
    </button>
  )
}

function signedCompactYen(n: number): string {
  if (n === 0) return '0'
  const sign = n > 0 ? '+' : '-'
  return `${sign}${compactYen(Math.abs(n))}`
}

function compactYen(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000) / 10}万`
  if (n >= 1000) return `${Math.round(n / 100) / 10}千`
  return String(n)
}
