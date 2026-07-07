"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const dayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const monthLabels = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

function parseDateValue(value?: string | null) {
  if (!value) return null
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function toDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function sameDay(a: Date | null, b: Date | null) {
  return Boolean(a && b && toDateValue(a) === toDateValue(b))
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function buildCalendarDays(viewDate: Date) {
  const firstOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
  const start = new Date(firstOfMonth)
  start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay())

  const days: Date[] = []
  const cursor = new Date(start)
  for (let index = 0; index < 42; index += 1) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return days
}

export function Calendar({
  className,
  min,
  onChange,
  value,
}: {
  className?: string
  min?: string
  onChange?: (value: string) => void
  value?: string
}) {
  const selectedDate = parseDateValue(value)
  const minDate = parseDateValue(min)
  const today = startOfDay(new Date())
  const initialView = selectedDate ?? minDate ?? today
  const [viewDate, setViewDate] = React.useState(
    () => new Date(initialView.getFullYear(), initialView.getMonth(), 1),
  )

  const years = React.useMemo(() => {
    const start = Math.min(
      minDate?.getFullYear() ?? today.getFullYear(),
      viewDate.getFullYear(),
    )
    return Array.from({ length: 12 }, (_, index) => start + index)
  }, [minDate, today, viewDate])

  const days = buildCalendarDays(viewDate)
  const canGoPrevious =
    !minDate ||
    addMonths(viewDate, -1) >=
      new Date(minDate.getFullYear(), minDate.getMonth(), 1)

  return (
    <div
      data-slot="calendar"
      className={cn(
        "w-[248px] rounded-lg border bg-background p-3 shadow-sm",
        className,
      )}
    >
      <div className="relative mb-4 flex items-center justify-center">
        <Button
          aria-label="Previous month"
          className="absolute left-0 size-8 opacity-60"
          disabled={!canGoPrevious}
          onClick={() => setViewDate((current) => addMonths(current, -1))}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <ChevronLeftIcon />
        </Button>

        <div className="flex items-center gap-1.5">
          <Select
            value={String(viewDate.getMonth())}
            onValueChange={(nextMonth) =>
              setViewDate(
                new Date(viewDate.getFullYear(), Number(nextMonth), 1),
              )
            }
          >
            <SelectTrigger className="h-[34px] w-[74px] px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthLabels.map((month, index) => (
                <SelectItem key={month} value={String(index)}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(viewDate.getFullYear())}
            onValueChange={(nextYear) =>
              setViewDate(new Date(Number(nextYear), viewDate.getMonth(), 1))
            }
          >
            <SelectTrigger className="h-[34px] w-[82px] px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          aria-label="Next month"
          className="absolute right-0 size-8 opacity-60"
          onClick={() => setViewDate((current) => addMonths(current, 1))}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <ChevronRightIcon />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-y-2">
        {dayLabels.map((day) => (
          <div
            key={day}
            className="flex h-[21px] items-center justify-center rounded-md text-xs font-normal leading-4 text-muted-foreground"
          >
            {day}
          </div>
        ))}

        {days.map((date) => {
          const dateValue = toDateValue(date)
          const outside = date.getMonth() !== viewDate.getMonth()
          const selected = sameDay(date, selectedDate)
          const current = sameDay(date, today)
          const disabled = Boolean(minDate && startOfDay(date) < minDate)

          return (
            <Button
              key={dateValue}
              className={cn(
                "size-8 rounded-md p-0 text-sm font-normal leading-5 shadow-none",
                !selected && "hover:bg-accent hover:text-accent-foreground",
                outside && "text-muted-foreground opacity-50",
                current && !selected && "bg-accent text-accent-foreground",
              )}
              disabled={disabled}
              onClick={() => onChange?.(dateValue)}
              size="icon-sm"
              type="button"
              variant={selected ? "default" : "ghost"}
            >
              {date.getDate()}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
