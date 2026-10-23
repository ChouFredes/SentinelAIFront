"use client"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface SelectOption {
  value: string
  label: string
}

/** Select de un solo valor con opciones {value,label}; `items` hace que el trigger muestre la etiqueta. */
export function SimpleSelect({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
  size = "sm",
}: {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  ariaLabel: string
  className?: string
  size?: "sm" | "default"
}) {
  return (
    <Select
      value={value}
      items={options}
      onValueChange={(v) => v !== null && onValueChange(v as string)}
    >
      <SelectTrigger size={size} className={className} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
