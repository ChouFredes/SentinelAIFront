import { describe, expect, it } from "vitest"
import { alertViewSchema, isoDate, quarantineViewSchema, sensorTelemetryViewSchema } from "@/lib/api/schemas"
import { toUtcIso } from "@/lib/iso"
import { parseIso } from "@/lib/format"

describe("toUtcIso", () => {
  it("agrega Z cuando no hay offset (naive de Python)", () => {
    expect(toUtcIso("2026-10-19T17:10:32")).toBe("2026-10-19T17:10:32Z")
    expect(toUtcIso("2026-10-19T17:10:32.123456")).toBe("2026-10-19T17:10:32.123456Z")
  })

  it("deja intactas las fechas con offset", () => {
    for (const iso of [
      "2026-10-19T17:10:32Z",
      "2026-10-19T17:10:32z",
      "2026-10-19T17:10:32.123456Z",
      "2026-10-19T17:10:32+00:00",
      "2026-10-19T14:10:32-03:00",
      "2026-10-19T14:10:32-0300",
      "2026-10-19T20:10:32+03:00",
    ]) {
      expect(toUtcIso(iso), iso).toBe(iso)
    }
  })

  it("no confunde los guiones de la fecha con un offset", () => {
    expect(toUtcIso("2026-10-19T00:00:00")).toBe("2026-10-19T00:00:00Z")
  })

  it("parseIso da el mismo instante con y sin offset", () => {
    const t = Date.UTC(2026, 9, 19, 17, 10, 32)
    expect(parseIso("2026-10-19T17:10:32").getTime()).toBe(t)
    expect(parseIso("2026-10-19T17:10:32Z").getTime()).toBe(t)
    expect(parseIso("2026-10-19T14:10:32-03:00").getTime()).toBe(t)
  })
})

describe("isoDate (esquema)", () => {
  it("normaliza a UTC una fecha sin offset", () => {
    expect(isoDate.parse("2026-10-19T17:10:32")).toBe("2026-10-19T17:10:32Z")
    expect(isoDate.parse("2026-10-19T17:10:32.5")).toBe("2026-10-19T17:10:32.5Z")
  })

  it("deja intacta la que ya tiene offset", () => {
    expect(isoDate.parse("2026-10-19T17:10:32Z")).toBe("2026-10-19T17:10:32Z")
    expect(isoDate.parse("2026-10-19T14:10:32-03:00")).toBe("2026-10-19T14:10:32-03:00")
  })

  it("rechaza lo que no es un datetime ISO", () => {
    for (const bad of ["", "ayer", "2026-10-19", "19/10/2026 14:10", "2026-13-40T00:00:00", 1729357832]) {
      expect(isoDate.safeParse(bad).success, String(bad)).toBe(false)
    }
  })

  it("se aplica a los modelos, también en campos nullable", () => {
    const alert = alertViewSchema.parse({
      id: 1, site_id: 1, sensor_id: 7, source_ip: "203.0.113.45", destination_ip: "192.168.1.10", destination_port: 3389,
      mse_score: 0.0184, severity: "critical", anomaly: true, unrecognized_device: false, link_degraded: false,
      informative_only_mode: false, mitigation_applied: true, occurred_at: "2026-10-19T17:10:32.123456",
    })
    expect(alert.occurred_at).toBe("2026-10-19T17:10:32.123456Z")

    const telemetry = sensorTelemetryViewSchema.parse({
      sensor_id: 7, site_id: 1, is_active: true, last_heartbeat_at: null, last_ingest_at: "2026-10-19T17:10:32",
      flow_count: 10, last_link_degraded: false, last_link_report_at: null,
    })
    expect(telemetry.last_heartbeat_at).toBeNull()
    expect(telemetry.last_ingest_at).toBe("2026-10-19T17:10:32Z")

    const q = quarantineViewSchema.parse({
      source_ip: "203.0.113.45", destination_ip: "192.168.1.10", destination_port: 3389, mse_score: 0.01,
      quarantined_at: "2026-10-19T17:10:33", expires_at: "2026-10-19T17:11:33+00:00",
    })
    expect(q.quarantined_at).toBe("2026-10-19T17:10:33Z")
    expect(q.expires_at).toBe("2026-10-19T17:11:33+00:00")
  })
})
