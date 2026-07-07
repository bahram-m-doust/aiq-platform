"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

function formatDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return value

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day))
}

export function DatePicker({
  ariaDescribedBy,
  className,
  defaultValue = "",
  disabled = false,
  id,
  min,
  name,
  placeholder = "Pick a date",
  required = false,
}: {
  ariaDescribedBy?: string
  className?: string
  defaultValue?: string
  disabled?: boolean
  id?: string
  min?: string
  name?: string
  placeholder?: string
  required?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState(defaultValue)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          aria-describedby={ariaDescribedBy}
          aria-required={required}
          className={cn(
            "h-9 w-full justify-start border-input bg-background px-3 text-left text-sm font-normal leading-5 text-foreground shadow-xs hover:bg-background",
            !value && "text-muted-foreground",
            className,
          )}
          disabled={disabled}
          id={id}
          type="button"
          variant="outline"
        >
          <CalendarIcon className="mr-2 size-4 text-muted-foreground" />
          <span>{value ? formatDateLabel(value) : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <input name={name} type="hidden" value={value} />
      <PopoverContent
        align="start"
        className="w-auto border-0 bg-transparent p-0 shadow-none"
      >
        <Calendar
          min={min}
          value={value}
          onChange={(nextValue) => {
            setValue(nextValue)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
