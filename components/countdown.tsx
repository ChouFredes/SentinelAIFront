"use client"

import * as React from "react"
import { formatCountdown, parseIso } from "@/lib/format"

/** Reloj compartido: un solo intervalo de 1 s por componente que lo usa. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function Countdown({ expiresAt, className }: { expiresAt: string; className?: string }) {
  const now = useNow()
  const expired = parseIso(expiresAt).getTime() <= now
  return (
    <span className={className} suppressHydrationWarning>
      {expired ? "vencida" : formatCountdown(expiresAt, now)}
    </span>
  )
}
