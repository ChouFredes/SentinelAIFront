// Corre con la zona horaria del proceso en Buenos Aires (UTC-3): ahí un
// `Date.parse` ingenuo de una fecha sin offset daría 3 horas de diferencia.
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { alertViewSchema } from "@/lib/api/schemas"
import type { AdminQuarantineView, AlertView, MitigationEvent } from "@/lib/api/schemas"
import {
  deriveAlertState,
  findActiveQuarantine,
  findCoveringApply,
  findOwnApply,
  sensorStatus,
} from "@/lib/domain"
import { formatDateTime, formatTime, parseIso } from "@/lib/format"
import { mergeSummaries } from "@/lib/summary-utils"
import { computeSummary } from "@/lib/server/summary"

let previousTz: string | undefined
beforeAll(() => {
  previousTz = process.env.TZ
  process.env.TZ = "America/Argentina/Buenos_Aires"
})
afterAll(() => {
  if (previousTz === undefined) delete process.env.TZ
  else process.env.TZ = previousTz
})

const alert = (occurred_at: string): AlertView => ({
  id: 1, site_id: 1, sensor_id: 7, source_ip: "203.0.113.45", destination_ip: "192.168.1.10", destination_port: 3389,
  mse_score: 0.0184, severity: "critical", anomaly: true, unrecognized_device: false, link_degraded: false,
  informative_only_mode: false, mitigation_applied: true, occurred_at,
})
const event = (over: Partial<MitigationEvent>): MitigationEvent => ({
  id: 10, site_id: 1, sensor_id: 7, event_type: "APPLY", original_event_id: null, source_ip: "203.0.113.45",
  destination_ip: "192.168.1.10", destination_port: 3389, mse_score: 0.0184, reason: null,
  occurred_at: "2026-10-19T17:10:33Z", ...over,
})

describe("con TZ = Buenos Aires", () => {
  it("el entorno efectivamente está en UTC-3 (si no, esta suite no prueba nada)", () => {
    expect(new Date("2026-10-19T17:10:32").getHours()).toBe(17) // sin offset se lee como hora local...
    expect(new Date("2026-10-19T17:10:32Z").getHours()).toBe(14) // ...y con Z se corre 3 h
  })

  it("parseIso no depende de la zona del proceso", () => {
    expect(parseIso("2026-10-19T17:10:32").getTime()).toBe(Date.UTC(2026, 9, 19, 17, 10, 32))
    expect(formatDateTime("2026-10-19T17:10:32")).toBe("19/10/2026 14:10:32")
    expect(formatTime("2026-10-19T17:10:32")).toBe("14:10:32")
  })

  it("alerta sin offset y APPLY con Z se emparejan igual (±2 s)", () => {
    const naive = alert("2026-10-19T17:10:32")
    const apply = event({ occurred_at: "2026-10-19T17:10:33Z" })
    expect(findOwnApply(naive, [apply])?.id).toBe(10)
    expect(findOwnApply(alert("2026-10-19T17:10:32Z"), [apply])?.id).toBe(10)
    expect(findOwnApply(alert("2026-10-19T14:10:32-03:00"), [apply])?.id).toBe(10)
  })

  it("el emparejamiento no se rompe con ISO sin offset de los dos lados", () => {
    expect(findOwnApply(alert("2026-10-19T17:10:32"), [event({ occurred_at: "2026-10-19T17:10:33" })])?.id).toBe(10)
    expect(findOwnApply(alert("2026-10-19T17:10:32"), [event({ occurred_at: "2026-10-19T17:10:36" })])).toBeUndefined()
  })

  it("cuarentena activa y bloqueo previo mezclando formatos", () => {
    const now = Date.parse("2026-10-19T17:10:50Z")
    const q: AdminQuarantineView = {
      site_id: 1, source_ip: "203.0.113.45", destination_ip: "192.168.1.10", destination_port: 3389, mse_score: 0.01,
      quarantined_at: "2026-10-19T17:10:33", expires_at: "2026-10-19T17:11:33",
    }
    expect(findActiveQuarantine(alert("2026-10-19T17:10:32Z"), [q], now)).toBe(q)
    const repeated = alert("2026-10-19T17:10:40")
    expect(findCoveringApply(repeated, [event({ occurred_at: "2026-10-19T17:10:33Z" })])?.id).toBe(10)
    const reversion = event({ id: 11, event_type: "REVERSION", original_event_id: 10, occurred_at: "2026-10-19T17:11:33" })
    expect(deriveAlertState(repeated, [], [event({ occurred_at: "2026-10-19T17:10:33Z" }), reversion])).toBe("blocked_prior_quarantine")
    expect(deriveAlertState(alert("2026-10-19T17:12:00"), [], [event({ occurred_at: "2026-10-19T17:10:33Z" }), reversion])).toBe("detected")
  })

  it("sensorStatus con fechas sin offset", () => {
    const now = Date.parse("2026-10-19T17:10:50Z")
    const base = { is_active: true, last_link_degraded: false }
    expect(sensorStatus({ ...base, last_heartbeat_at: null, last_ingest_at: "2026-10-19T17:10:40" }, now)).toBe("online")
    expect(sensorStatus({ ...base, last_heartbeat_at: "2026-10-19T17:00:00", last_ingest_at: null }, now)).toBe("offline")
  })

  it("el esquema entrega fechas en UTC y las cuentas de resumen no se corren 3 h", () => {
    const parsed = alertViewSchema.parse(alert("2026-10-19T17:10:32.250000"))
    expect(parsed.occurred_at).toBe("2026-10-19T17:10:32.250000Z")
    const now = Date.parse("2026-10-19T18:00:00Z")
    const summary = computeSummary([parsed], 1, 2, 0, now)
    expect(summary.total_alerts).toBe(1)
    expect(summary.by_hour.map((h) => h.hour)).toEqual(["2026-10-19T17:00:00.000Z", "2026-10-19T18:00:00.000Z"])
    expect(summary.by_hour[0].count).toBe(1)
  })

  it("mergeSummaries ordena por instante, no por texto local", () => {
    const mk = (hours: string[]) => ({
      site_id: 1, hours: 2, total_alerts: 0, flows_analyzed: 0, top_sources: [],
      by_severity: { warning: 0, high: 0, critical: 0 }, by_hour: hours.map((hour) => ({ hour, count: 1 })),
    })
    const merged = mergeSummaries([mk(["2026-10-19T18:00:00Z"]), mk(["2026-10-19T17:00:00"])])!
    expect(merged.by_hour.map((h) => h.hour)).toEqual(["2026-10-19T17:00:00", "2026-10-19T18:00:00Z"])
  })
})
