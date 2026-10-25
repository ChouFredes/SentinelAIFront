import { toUtcIso } from "@/lib/iso"

const TZ = "America/Argentina/Buenos_Aires"

/** Un ISO sin offset (naive de Python) se toma como UTC. */
export function parseIso(iso: string): Date {
  return new Date(toUtcIso(iso))
}

const dateTime = new Intl.DateTimeFormat("es-AR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})
const shortDateTime = new Intl.DateTimeFormat("es-AR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})
const time = new Intl.DateTimeFormat("es-AR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

/** "19/10/2026 14:10:32" */
export function formatDateTime(iso: string): string {
  return dateTime.format(parseIso(iso)).replace(",", "")
}

/** "19/10 14:10" */
export function formatShortDateTime(iso: string): string {
  return shortDateTime.format(parseIso(iso)).replace(",", "")
}

/** "14:10:32" */
export function formatTime(iso: string): string {
  return time.format(parseIso(iso))
}

/** MSE con 5 decimales y coma: "0,01840". */
export function formatMse(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 5, maximumFractionDigits: 5 })
}

/** Umbral τ con 6 decimales: "0,000308". */
export function formatTau(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 6, maximumFractionDigits: 6 })
}

export function formatInt(n: number): string {
  return n.toLocaleString("es-AR")
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${units[unit]}`
}

/** Cuenta regresiva: "1:05", "0:42", "0:00" si ya venció. */
export function formatCountdown(expiresAtIso: string, now = Date.now()): string {
  const secs = Math.max(0, Math.ceil((parseIso(expiresAtIso).getTime() - now) / 1000))
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`
}

/** "hace 5 min", "hace 2 h", "hace 3 d" */
export function formatRelative(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - parseIso(iso).getTime()) / 1000))
  if (s < 60) return "hace instantes"
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  return `hace ${Math.floor(s / 86400)} d`
}

const hourOnly = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, hour: "2-digit", hour12: false })
const dayHour = new Intl.DateTimeFormat("es-AR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  hour12: false,
})

/** "14" (hora en Buenos Aires). */
export function formatHour(iso: string): string {
  return hourOnly.format(parseIso(iso))
}

/** "19/10 14 h" para tooltips. */
export function formatDayHour(iso: string): string {
  return `${dayHour.format(parseIso(iso)).replace(",", "")} h`
}
