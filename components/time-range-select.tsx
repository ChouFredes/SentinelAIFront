"use client"

import * as React from "react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const RANGES = [
  { value: "1h", label: "Última hora" },
  { value: "24h", label: "24 horas" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
]

export function TimeRangeSelect() {
  const [value, setValue] = React.useState("24h")

  return (
    <Select value={value} onValueChange={(v) => setValue(v as string)}>
      <SelectTrigger
        size="sm"
        className="w-[130px]"
        aria-label="Seleccionar rango temporal"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {RANGES.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
