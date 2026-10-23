import { describe, expect, it } from "vitest"
import {
  HEARTBEAT_TIMEOUT_MS,
  deriveAlertState,
  hasActiveQuarantine,
  latestSensorActivity,
  parseThreshold,
  sensorStatus,
} from "@/lib/domain"
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

describe("parseThreshold", () => {
  it("acepta coma o punto, vacío = τ global", () => {
    expect(parseThreshold("0,0004")).toBe(0.0004)
    expect(parseThreshold("0.0004")).toBe(0.0004)
    expect(parseThreshold("  ")).toBeNull()
  })

  it("rechaza cero, negativos y texto", () => {
    for (const bad of ["0", "-1", "abc", "1,2,3", "NaN"]) expect(parseThreshold(bad), bad).toBeUndefined()
  })
})

describe("sensorStatus", () => {
  const NOW = Date.parse("2026-10-23T17:00:00Z")
  const ago = (ms: number) => new Date(NOW - ms).toISOString()
  const sensor = (over: Partial<Parameters<typeof sensorStatus>[0]> = {}) => ({
    is_active: true,
    last_heartbeat_at: null as string | null,
    last_ingest_at: null as string | null,
    last_link_degraded: false,
    ...over,
  })

  it("usa la fecha más reciente entre latido e ingest", () => {
    expect(latestSensorActivity({ last_heartbeat_at: ago(500_000), last_ingest_at: ago(10_000) })).toBe(ago(10_000))
    expect(latestSensorActivity({ last_heartbeat_at: ago(10_000), last_ingest_at: ago(500_000) })).toBe(ago(10_000))
    expect(latestSensorActivity({ last_heartbeat_at: null, last_ingest_at: null })).toBeNull()
  })

  it("ingest reciente con heartbeat viejo → en línea", () => {
    const s = sensor({ last_heartbeat_at: ago(HEARTBEAT_TIMEOUT_MS * 10), last_ingest_at: ago(5_000) })
    expect(sensorStatus(s, NOW)).toBe("online")
  })

  it("heartbeat reciente sin ingest → en línea", () => {
    expect(sensorStatus(sensor({ last_heartbeat_at: ago(5_000) }), NOW)).toBe("online")
  })

  it("solo ingest (sensor Edge, sin heartbeat) → en línea", () => {
    expect(sensorStatus(sensor({ last_ingest_at: ago(5_000) }), NOW)).toBe("online")
  })

  it("sin ninguna fecha → sin conexión", () => {
    expect(sensorStatus(sensor(), NOW)).toBe("offline")
  })

  it("ambas fechas vencidas → sin conexión", () => {
    const s = sensor({ last_heartbeat_at: ago(HEARTBEAT_TIMEOUT_MS + 1), last_ingest_at: ago(HEARTBEAT_TIMEOUT_MS + 5_000) })
    expect(sensorStatus(s, NOW)).toBe("offline")
  })

  it("justo en el límite sigue en línea", () => {
    expect(sensorStatus(sensor({ last_ingest_at: ago(HEARTBEAT_TIMEOUT_MS) }), NOW)).toBe("online")
  })

  it("sensor inactivo → sin conexión aunque tenga actividad reciente", () => {
    expect(sensorStatus(sensor({ is_active: false, last_ingest_at: ago(1_000) }), NOW)).toBe("offline")
  })

  it("enlace degradado prevalece sobre en línea, no sobre sin conexión", () => {
    expect(sensorStatus(sensor({ last_ingest_at: ago(1_000), last_link_degraded: true }), NOW)).toBe("link_degraded")
    expect(sensorStatus(sensor({ last_link_degraded: true }), NOW)).toBe("offline")
  })
})
