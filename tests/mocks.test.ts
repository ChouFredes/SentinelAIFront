import { beforeEach, describe, expect, it } from "vitest"
import { z } from "zod"
import {
  adminQuarantineViewSchema,
  alertViewSchema,
  flowSampleSchema,
  mitigationEventSchema,
  sensorTelemetryViewSchema,
  siteConfigViewSchema,
  siteSensorViewSchema,
  siteSummarySchema,
  siteViewSchema,
} from "@/lib/api/schemas"
import {
  mockAlerts,
  mockFlows,
  mockMitigationEvents,
  mockQuarantines,
  mockRevert,
  mockSiteSensors,
  mockSites,
  mockTelemetry,
  mockUpdateSiteConfig,
  resetMockStore,
} from "@/lib/api/mocks/store"
import {
  QUARANTINE_MATCH_WINDOW_MS as WINDOW,
  criticalThreshold,
  deriveAlertState,
  effectiveThreshold,
  findCoveringApply,
  findOwnApply,
  hasActiveQuarantine,
} from "@/lib/domain"
import { isPrivateIp, isQuarantinable } from "@/lib/cidr"
import { BackendError } from "@/lib/server/errors"
import { computeSummary } from "@/lib/server/summary"

beforeEach(() => resetMockStore())

describe("mocks cumplen los esquemas", () => {
  it("todos los datos validan con Zod", () => {
    z.array(alertViewSchema).parse(mockAlerts())
    z.array(siteViewSchema).parse(mockSites())
    z.array(adminQuarantineViewSchema).parse(mockQuarantines())
    z.array(mitigationEventSchema).parse(mockMitigationEvents({}))
    for (const s of mockSites()) z.array(siteSensorViewSchema).parse(mockSiteSensors(s.id))
    sensorTelemetryViewSchema.parse(mockTelemetry(7))
    z.array(flowSampleSchema).parse(mockFlows(7))
    siteSummarySchema.parse(computeSummary(mockAlerts(), 1, 24, 0))
  })

  it("hay alertas variadas y cuarentenas activas", () => {
    const alerts = mockAlerts()
    expect(alerts.length).toBeGreaterThan(100)
    expect(new Set(alerts.map((a) => a.severity)).size).toBe(3)
    expect(alerts.some((a) => a.unrecognized_device)).toBe(true)
    expect(alerts.some((a) => a.link_degraded)).toBe(true)
    expect(mockQuarantines().length).toBeGreaterThanOrEqual(2)
  })

  it("una advertencia nunca dispara cuarentena", () => {
    const warnings = mockAlerts().filter((a) => a.severity === "warning")
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings.every((a) => !a.mitigation_applied)).toBe(true)
    const applies = mockMitigationEvents({ limit: 1000 }).filter((e) => e.event_type === "APPLY")
    for (const w of warnings) {
      expect(applies.some((e) => e.site_id === w.site_id && e.source_ip === w.source_ip && Math.abs(Date.parse(e.occurred_at) - Date.parse(w.occurred_at)) <= WINDOW)).toBe(false)
    }
  })

  it("cada APPLY tiene exactamente una alerta mitigada propia a ±2 s", () => {
    const alerts = mockAlerts()
    const applies = mockMitigationEvents({ limit: 1000 }).filter((e) => e.event_type === "APPLY")
    for (const e of applies) {
      const own = alerts.filter((a) => a.mitigation_applied && a.site_id === e.site_id && a.source_ip === e.source_ip && Math.abs(Date.parse(a.occurred_at) - Date.parse(e.occurred_at)) <= WINDOW)
      expect(own, `APPLY #${e.id}`).toHaveLength(1)
    }
  })

  it("una alerta mitigada tiene su APPLY propio o cae dentro de una cuarentena previa", () => {
    const events = mockMitigationEvents({ limit: 1000 })
    for (const a of mockAlerts().filter((x) => x.mitigation_applied)) {
      const own = findOwnApply(a, events)
      const covering = findCoveringApply(a, events)
      expect(own !== undefined || covering !== undefined, `alerta #${a.id}`).toBe(true)
      if (own) expect(covering === undefined || covering.id === own.id || Date.parse(covering.occurred_at) < Date.parse(own.occurred_at)).toBe(true)
    }
  })

  it("hay alertas repetidas: mitigation_applied=true sin APPLY nuevo, dentro de una cuarentena previa", () => {
    const events = mockMitigationEvents({ limit: 1000 })
    const repeated = mockAlerts().filter((a) => a.mitigation_applied && findOwnApply(a, events) === undefined)
    expect(repeated.length).toBeGreaterThan(0)
    for (const a of repeated) {
      const prior = findCoveringApply(a, events)!
      expect(prior, `alerta #${a.id}`).toBeDefined()
      expect(prior.source_ip).toBe(a.source_ip) // la regla de iptables es por IP
      expect(Date.parse(prior.occurred_at)).toBeLessThanOrEqual(Date.parse(a.occurred_at))
      const reversion = events.find((e) => e.original_event_id === prior.id)
      if (reversion) expect(Date.parse(a.occurred_at)).toBeLessThan(Date.parse(reversion.occurred_at))
      // la repetición no generó ningún evento propio
      expect(events.some((e) => e.source_ip === a.source_ip && e.occurred_at === a.occurred_at)).toBe(false)
      expect(deriveAlertState(a, [], events)).toBe(prior.site_id === a.site_id ? "blocked_prior_quarantine" : "blocked_other_site")
    }
  })

  it("hay repeticiones del mismo sitio y de otro sitio", () => {
    const events = mockMitigationEvents({ limit: 1000 })
    const states = mockAlerts().map((a) => deriveAlertState(a, [], events))
    expect(states).toContain("blocked_prior_quarantine")
    expect(states).toContain("blocked_other_site")
  })

  it("una repetición de una cuarentena activa se muestra como bloqueada y sin botón Revertir", () => {
    const events = mockMitigationEvents({ limit: 1000 })
    const quarantines = mockQuarantines()
    const repeated = mockAlerts().filter((a) => a.mitigation_applied && findOwnApply(a, events) === undefined)
    const inActive = repeated.filter((a) => quarantines.some((q) => q.source_ip === a.source_ip))
    expect(inActive.length).toBeGreaterThan(0)
    for (const a of inActive) {
      expect(hasActiveQuarantine(a, quarantines)).toBe(false)
      expect(["blocked_prior_quarantine", "blocked_other_site"]).toContain(deriveAlertState(a, quarantines, events))
    }
    // y la alerta que originó cada cuarentena sigue siendo la única con botón
    for (const q of quarantines) {
      const withButton = mockAlerts().filter((a) => hasActiveQuarantine(a, [q]))
      expect(withButton).toHaveLength(1)
    }
  })

  it("una cuarentena activa de otro sitio bloquea la alerta sin botón Revertir en ese sitio", () => {
    const events = mockMitigationEvents({ limit: 1000 })
    const quarantines = mockQuarantines()
    const crossSite = mockAlerts().filter((a) => {
      if (!a.mitigation_applied || findOwnApply(a, events)) return false
      return quarantines.some((q) => q.source_ip === a.source_ip && q.site_id !== a.site_id) && deriveAlertState(a, quarantines, events) === "blocked_other_site"
    })
    expect(crossSite.length).toBeGreaterThan(0)
    for (const a of crossSite) expect(hasActiveQuarantine(a, quarantines)).toBe(false)
  })

  it("nunca hay dos APPLY solapados para la misma IP, aunque sean de sitios distintos", () => {
    const events = mockMitigationEvents({ limit: 1000 })
    const applies = events.filter((e) => e.event_type === "APPLY").sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at))
    for (const [i, e] of applies.entries()) {
      const next = applies.slice(i + 1).find((x) => x.source_ip === e.source_ip)
      if (!next) continue
      const reversion = events.find((r) => r.original_event_id === e.id)
      expect(reversion, `APPLY #${e.id} sin reversión pero hay otro posterior de la misma IP`).toBeDefined()
      expect(Date.parse(reversion!.occurred_at)).toBeLessThanOrEqual(Date.parse(next.occurred_at))
    }
  })

  it("cada cuarentena activa tiene exactamente una alerta emparejada", () => {
    const alerts = mockAlerts()
    for (const q of mockQuarantines()) {
      const matches = alerts.filter(
        (a) =>
          a.site_id === q.site_id &&
          a.source_ip === q.source_ip &&
          Math.abs(Date.parse(a.occurred_at) - Date.parse(q.quarantined_at)) <= WINDOW,
      )
      expect(matches).toHaveLength(1)
      expect(matches[0].mitigation_applied).toBe(true)
      expect(matches[0].severity).not.toBe("warning")
    }
  })

  it("nunca hay dos cuarentenas activas para el mismo sitio e IP", () => {
    const keys = mockQuarantines().map((q) => `${q.site_id}|${q.source_ip}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("anomaly y severidad siguen la regla de /ingest con el umbral del sitio", () => {
    const customBySite = new Map(mockSites().map((s) => [s.id, s.config.custom_mse_threshold]))
    for (const a of mockAlerts()) {
      const custom = customBySite.get(a.site_id) ?? null
      const threshold = effectiveThreshold(custom)
      expect(a.anomaly, `anomaly #${a.id}`).toBe(a.mse_score > threshold)
      expect(a.severity === "critical", `critical #${a.id}`).toBe(a.mse_score >= criticalThreshold(custom))
      expect(a.severity === "high", `high #${a.id}`).toBe(a.anomaly && a.mse_score < criticalThreshold(custom))
      expect(a.severity === "warning", `warning #${a.id}`).toBe(!a.anomaly)
    }
  })

  it("toda warning tiene MSE bajo el umbral y al menos un flag que justifica la alerta", () => {
    const customBySite = new Map(mockSites().map((s) => [s.id, s.config.custom_mse_threshold]))
    const warnings = mockAlerts().filter((a) => a.severity === "warning")
    expect(warnings.length).toBeGreaterThan(0)
    for (const w of warnings) {
      expect(w.mse_score).toBeLessThanOrEqual(effectiveThreshold(customBySite.get(w.site_id) ?? null))
      expect(w.unrecognized_device || w.link_degraded, `warning #${w.id}`).toBe(true)
    }
  })

  it("ninguna alerta existe sin anomalía, dispositivo no reconocido ni enlace degradado", () => {
    for (const a of mockAlerts()) {
      expect(a.anomaly || a.unrecognized_device || a.link_degraded, `alerta #${a.id}`).toBe(true)
    }
  })

  it("las IP privadas con anomalía también se mitigan, y solo se excluyen las IP protegidas", () => {
    const mitigated = mockAlerts().filter((a) => a.mitigation_applied)
    expect(mitigated.some((a) => isPrivateIp(a.source_ip))).toBe(true)
    expect(mitigated.some((a) => !isPrivateIp(a.source_ip))).toBe(true)
    expect(mitigated.every((a) => isQuarantinable(a.source_ip))).toBe(true)
    // Toda anomalía de un sitio con respuesta activa, sin enlace degradado y con IP aislable, se mitiga.
    const active = new Set(mockSites().filter((s) => s.config.active_response_enabled && !s.config.informative_only_mode).map((s) => s.id))
    for (const a of mockAlerts()) {
      const expected = a.anomaly && active.has(a.site_id) && !a.link_degraded && isQuarantinable(a.source_ip)
      expect(a.mitigation_applied, `alerta #${a.id}`).toBe(expected)
    }
  })

  it("solo una anomalía puede mitigarse, y nunca con modo informativo o enlace degradado", () => {
    for (const a of mockAlerts().filter((x) => x.mitigation_applied)) {
      expect(a.anomaly).toBe(true)
      expect(a.informative_only_mode).toBe(false)
      expect(a.link_degraded).toBe(false)
    }
  })

  it("cada reversión referencia un APPLY existente", () => {
    const events = mockMitigationEvents({ limit: 1000 })
    const applies = new Set(events.filter((e) => e.event_type === "APPLY").map((e) => e.id))
    for (const e of events.filter((e) => e.event_type !== "APPLY")) {
      expect(applies.has(e.original_event_id!)).toBe(true)
    }
  })
})

describe("revert", () => {
  it("revierte una cuarentena activa y registra MANUAL_REVERSION", () => {
    const q = mockQuarantines()[0]
    const res = mockRevert(q.source_ip, q.site_id)
    expect(res).toEqual({ site_id: q.site_id, source_ip: q.source_ip, reverted: true, rule_was_present: true })
    expect(mockQuarantines().some((x) => x.source_ip === q.source_ip && x.site_id === q.site_id)).toBe(false)
    const last = mockMitigationEvents({ site_id: q.site_id, source_ip: q.source_ip })[0]
    expect(last.event_type).toBe("MANUAL_REVERSION")
    expect(last.reason).toBe("administrator_manual_reversion")
  })

  it("404 sin cuarentena activa", () => {
    expect(() => mockRevert("198.18.0.1")).toThrowError(BackendError)
    try {
      mockRevert("198.18.0.1")
    } catch (e) {
      expect((e as BackendError).status).toBe(404)
    }
  })

  it("no se puede revertir dos veces", () => {
    const q = mockQuarantines()[0]
    mockRevert(q.source_ip, q.site_id)
    expect(() => mockRevert(q.source_ip, q.site_id)).toThrowError(/cuarentena activa/)
  })
})

describe("config", () => {
  it("aplica un update parcial", () => {
    const res = mockUpdateSiteConfig(2, { informative_only_mode: false })
    expect(siteConfigViewSchema.parse(res).informative_only_mode).toBe(false)
    expect(res.known_devices).toEqual(["192.168.2.0/27", "192.168.2.9/32"])
  })

  it("custom_mse_threshold null vuelve a τ global", () => {
    expect(mockUpdateSiteConfig(3, { custom_mse_threshold: null }).custom_mse_threshold).toBeNull()
  })

  it("rechaza CIDR inválidos con 422", () => {
    try {
      mockUpdateSiteConfig(1, { known_devices: ["no-es-cidr"] })
      expect.unreachable()
    } catch (e) {
      expect((e as BackendError).status).toBe(422)
    }
  })
})

describe("summary", () => {
  it("cuenta por severidad y por hora", () => {
    const alerts = mockAlerts()
    const s = computeSummary(alerts, 1, 24 * 7, 0)
    expect(s.by_hour).toHaveLength(24 * 7)
    expect(s.by_hour.reduce((a, b) => a + b.count, 0)).toBe(s.total_alerts)
    expect(s.by_severity.warning + s.by_severity.high + s.by_severity.critical).toBe(s.total_alerts)
    expect(s.top_sources.length).toBeLessThanOrEqual(5)
  })
})
