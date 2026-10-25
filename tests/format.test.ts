import { describe, expect, it } from "vitest"
import {
  formatCountdown,
  formatDateTime,
  formatDestination,
  formatMse,
  formatMseOrDash,
  formatShortDateTime,
  formatTime,
} from "@/lib/format"

describe("format", () => {
  it("muestra fechas en hora de Buenos Aires (UTC-3)", () => {
    expect(formatDateTime("2026-10-19T17:10:32Z")).toBe("19/10/2026 14:10:32")
    expect(formatShortDateTime("2026-10-19T17:10:32Z")).toBe("19/10 14:10")
    expect(formatTime("2026-10-19T02:00:00Z")).toBe("23:00:00")
  })

  it("cruza el día correctamente", () => {
    expect(formatDateTime("2026-10-20T01:30:00+00:00")).toBe("19/10/2026 22:30:00")
  })

  it("toma un datetime sin offset como UTC", () => {
    expect(formatDateTime("2026-10-19T17:10:32")).toBe("19/10/2026 14:10:32")
  })

  it("formatea MSE con coma", () => {
    expect(formatMse(0.0184)).toBe("0,01840")
  })

  it("cuenta regresiva", () => {
    const now = Date.parse("2026-10-19T17:00:00Z")
    expect(formatCountdown("2026-10-19T17:01:05Z", now)).toBe("1:05")
    expect(formatCountdown("2026-10-19T16:59:00Z", now)).toBe("0:00")
  })
})

describe("campos que pueden venir nulos", () => {
  it("formatDestination", () => {
    expect(formatDestination("192.168.1.10", 3389)).toBe("192.168.1.10:3389")
    expect(formatDestination("192.168.1.10", null)).toBe("192.168.1.10")
    expect(formatDestination(null, 445)).toBe("—:445")
    expect(formatDestination(null, null)).toBe("—")
    expect(formatDestination(undefined, undefined)).toBe("—")
    expect(formatDestination("", 0)).toBe("—:0") // el puerto 0 es un valor, no ausencia
  })

  it("formatMseOrDash", () => {
    expect(formatMseOrDash(0.0184)).toBe("0,01840")
    expect(formatMseOrDash(0)).toBe("0,00000")
    expect(formatMseOrDash(null)).toBe("—")
    expect(formatMseOrDash(undefined)).toBe("—")
  })
})
