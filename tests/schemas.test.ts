import { describe, expect, it } from "vitest"
import { mitigationEventSchema } from "@/lib/api/schemas"

const base = {
  id: 7,
  site_id: 1,
  sensor_id: 7,
  event_type: "APPLY",
  original_event_id: null,
  source_ip: "203.0.113.45",
  destination_ip: "192.168.1.10",
  destination_port: 3389,
  mse_score: 0.0184,
  reason: null,
  occurred_at: "2026-10-19T17:10:33",
}

describe("mitigationEventSchema", () => {
  it("acepta un evento completo", () => {
    const e = mitigationEventSchema.parse(base)
    expect(e.destination_ip).toBe("192.168.1.10")
    expect(e.occurred_at).toBe("2026-10-19T17:10:33Z")
  })

  it("acepta destination_ip, destination_port y mse_score nulos (reglas importadas)", () => {
    const e = mitigationEventSchema.parse({
      ...base,
      sensor_id: null,
      destination_ip: null,
      destination_port: null,
      mse_score: null,
      reason: "legacy_quarantine_import",
    })
    expect(e.destination_ip).toBeNull()
    expect(e.destination_port).toBeNull()
    expect(e.mse_score).toBeNull()
  })

  it("reason es texto libre: acepta conocidos, desconocidos y null", () => {
    for (const reason of ["quarantine_timer_elapsed", "administrator_manual_reversion", "legacy_quarantine_import", "motivo_nuevo_del_backend", "", null]) {
      expect(mitigationEventSchema.safeParse({ ...base, reason }).success, String(reason)).toBe(true)
    }
  })

  it("sigue rechazando tipos incorrectos y campos faltantes", () => {
    for (const bad of [
      { ...base, reason: 5 },
      { ...base, destination_port: "3389" },
      { ...base, destination_ip: 10 },
      { ...base, mse_score: "0.01" },
      { ...base, event_type: "DELETE" },
      { ...base, id: "7" },
      { ...base, source_ip: null },
      { ...base, occurred_at: "ayer" },
    ]) {
      expect(mitigationEventSchema.safeParse(bad).success).toBe(false)
    }
    const { destination_ip: _omitted, ...missing } = base
    void _omitted
    expect(mitigationEventSchema.safeParse(missing).success).toBe(false)
  })
})
