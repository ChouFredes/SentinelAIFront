import { describe, expect, it } from "vitest"
import { deriveAlertState, hasActiveQuarantine } from "@/lib/domain"
import type { AdminQuarantineView, AlertView, MitigationEvent } from "@/lib/api/schemas"

const T0 = "2026-10-19T17:10:32.000Z"

const alert = (over: Partial<AlertView> = {}): AlertView => ({
  id: 1,
  site_id: 1,
  sensor_id: 7,
  source_ip: "203.0.113.45",
  destination_ip: "192.168.1.10",
  destination_port: 3389,
  mse_score: 0.0184,
  severity: "critical",
  anomaly: true,
  unrecognized_device: false,
  link_degraded: false,
  informative_only_mode: false,
  mitigation_applied: true,
  occurred_at: T0,
  ...over,
})

const ev = (over: Partial<MitigationEvent>): MitigationEvent => ({
  id: 1,
  site_id: 1,
  sensor_id: 7,
  event_type: "APPLY",
  original_event_id: null,
  source_ip: "203.0.113.45",
  destination_ip: "192.168.1.10",
  destination_port: 3389,
  mse_score: 0.0184,
  reason: null,
  occurred_at: "2026-10-19T17:10:33.000Z",
  ...over,
})

const quarantine = (over: Partial<AdminQuarantineView> = {}): AdminQuarantineView => ({
  site_id: 1,
  source_ip: "203.0.113.45",
  destination_ip: "192.168.1.10",
  destination_port: 3389,
  mse_score: 0.0184,
  quarantined_at: "2026-10-19T17:10:33.000Z",
  expires_at: new Date(Date.now() + 30_000).toISOString(),
  ...over,
})

describe("deriveAlertState", () => {
  it("cuarentena activa gana sobre todo", () => {
    expect(deriveAlertState(alert(), [quarantine()], [])).toBe("quarantine_active")
  })

  it("ignora cuarentenas vencidas o de otro sitio", () => {
    const old = quarantine({ expires_at: new Date(Date.now() - 1000).toISOString() })
    expect(hasActiveQuarantine(alert(), [old])).toBe(false)
    expect(hasActiveQuarantine(alert(), [quarantine({ site_id: 2 })])).toBe(false)
  })

  it("modo informativo", () => {
    expect(deriveAlertState(alert({ informative_only_mode: true, mitigation_applied: false }), [], [])).toBe("informative")
  })

  it("suspendida por enlace degradado", () => {
    expect(deriveAlertState(alert({ link_degraded: true, mitigation_applied: false }), [], [])).toBe("suspended_link")
  })

  it("revertida por temporizador y manual", () => {
    const apply = ev({ id: 10 })
    const timer = ev({ id: 11, event_type: "REVERSION", original_event_id: 10 })
    const manual = ev({ id: 11, event_type: "MANUAL_REVERSION", original_event_id: 10 })
    expect(deriveAlertState(alert(), [], [apply, timer])).toBe("reverted_timer")
    expect(deriveAlertState(alert(), [], [apply, manual])).toBe("reverted_manual")
  })

  it("detectada sin más", () => {
    expect(deriveAlertState(alert({ mitigation_applied: false }), [], [])).toBe("detected")
  })
})
