import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ja } from 'date-fns/locale'
import { useCallback, useMemo, useRef, useState, type PointerEvent, type MouseEvent } from 'react'
import { DayCell } from './DayCell'
import { formatYen } from '../finance'
import type { DayMoney } from '../types'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const SWIPE_LOCK = 12
const SWIPE_DISTANCE = 56
const SWIPE_FLICK_DISTANCE = 28
const SWIPE_VELOCITY = 0.4

type Props = {
  month: Date
  onMonthChange: (d: Date) => void
  moneyByDate: Map<string, DayMoney>
  onDayTap: (dateKey: string) => void
}

type SwipeStart = {
  id: number
  x: number
  y: number
  t: number
  locked: boolean
}

export function MonthGrid({
  month,
  onMonthChange,
  moneyByDate,
  onDayTap,
}: Props) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start, end })
  const monthNet = useMemo(() => {
    const prefix = format(month, 'yyyy-MM')
    let net = 0
    for (const [dateKey, money] of moneyByDate) {
      if (dateKey.startsWith(prefix)) net += money.net
    }
    return net
  }, [moneyByDate, month])
  const netClass =
    monthNet > 0 ? 'is-income' : monthNet < 0 ? 'is-expense' : 'is-zero'
  const swipeRef = useRef<SwipeStart | null>(null)
  const suppressClickRef = useRef(false)
  const [slideIn, setSlideIn] = useState<'prev' | 'next' | null>(null)

  const shiftMonth = useCallback(
    (delta: number) => {
      setSlideIn(delta > 0 ? 'next' : 'prev')
      onMonthChange(addMonths(month, delta))
    },
    [month, onMonthChange],
  )

  function onPointerDown(e: PointerEvent<HTMLElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    swipeRef.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      t: e.timeStamp,
      locked: false,
    }
    suppressClickRef.current = false
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    const swipe = swipeRef.current
    if (!swipe || swipe.id !== e.pointerId || swipe.locked) return
    const dx = e.clientX - swipe.x
    const dy = e.clientY - swipe.y
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)
    if (absX < SWIPE_LOCK && absY < SWIPE_LOCK) return
    if (absX <= absY) {
      swipeRef.current = null
      return
    }
    swipe.locked = true
    suppressClickRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function finishSwipe(e: PointerEvent<HTMLElement>) {
    const swipe = swipeRef.current
    if (!swipe || swipe.id !== e.pointerId) return
    swipeRef.current = null
    if (!swipe.locked) return
    const dx = e.clientX - swipe.x
    const dy = e.clientY - swipe.y
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)
    const dt = Math.max(1, e.timeStamp - swipe.t)
    const isHorizontal = absX > absY * 1.15
    const isFlick =
      absX >= SWIPE_DISTANCE ||
      (absX >= SWIPE_FLICK_DISTANCE && absX / dt >= SWIPE_VELOCITY)
    if (!isHorizontal || !isFlick) return
    shiftMonth(dx < 0 ? 1 : -1)
  }

  function abortSwipe(e: PointerEvent<HTMLElement>) {
    const swipe = swipeRef.current
    if (!swipe || swipe.id !== e.pointerId) return
    swipeRef.current = null
  }

  function onClickCapture(e: MouseEvent<HTMLElement>) {
    if (!suppressClickRef.current) return
    e.preventDefault()
    e.stopPropagation()
    suppressClickRef.current = false
  }

  return (
    <section
      className="month-panel"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishSwipe}
      onPointerCancel={abortSwipe}
      onClickCapture={onClickCapture}
    >
      <header className="month-header">
        <button
          type="button"
          className="nav-btn"
          onClick={() => shiftMonth(-1)}
          aria-label="前月"
        >
          ‹
        </button>
        <h1 className="month-title" aria-live="polite">
          <span className="month-title__label">
            {format(month, 'yyyy年 M月', { locale: ja })}
          </span>
          <span className={['month-title__net', netClass].join(' ')}>
            総差額 {monthNet > 0 ? '+' : ''}
            {formatYen(monthNet)}
          </span>
        </h1>
        <button
          type="button"
          className="nav-btn"
          onClick={() => shiftMonth(1)}
          aria-label="翌月"
        >
          ›
        </button>
      </header>

      <div className="weekday-row" role="row">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={[
              'weekday',
              i === 0 ? 'is-sun' : '',
              i === 6 ? 'is-sat' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {w}
          </div>
        ))}
      </div>

      <div
        className={[
          'month-grid',
          slideIn === 'next' ? 'is-slide-next' : '',
          slideIn === 'prev' ? 'is-slide-prev' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        key={format(month, 'yyyy-MM')}
        role="grid"
      >
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          return (
            <DayCell
              key={key}
              date={day}
              currentMonth={month}
              money={moneyByDate.get(key)}
              onDayTap={onDayTap}
            />
          )
        })}
      </div>
    </section>
  )
}
