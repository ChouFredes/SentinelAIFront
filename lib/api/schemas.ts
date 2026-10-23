// Replica de los modelos Pydantic del backend (FastAPI). Si el backend cambia,
// se actualiza acá primero. Las secciones "Propuesto" son endpoints que todavía
// no existen: el BFF los resuelve con mocks (ver docs/backend-pendiente.md).
import { z } from "zod"

/** ISO 8601 UTC. Un datetime sin offset (naive de Python) se interpreta como UTC. */
export const isoDate = z.iso.datetime({ offset: true, local: true })

export const severitySchema = z.enum(["warning", "high", "critical"])
export type Severity = z.infer<typeof severitySchema>

// --- Existente en el backend ------------------------------------------------

export const alertViewSchema = z.object({
  id: z.number().int(),
  site_id: z.number().int(),
  sensor_id: z.number().int(),
  source_ip: z.string(),
  destination_ip: z.string(),
  destination_port: z.number().int(),
  mse_score: z.number(),
  severity: severitySchema,
  anomaly: z.boolean(),
  unrecognized_device: z.boolean(),
  link_degraded: z.boolean(),
  informative_only_mode: z.boolean(),
  mitigation_applied: z.boolean(),
  occurred_at: isoDate,
})
export type AlertView = z.infer<typeof alertViewSchema>

export const sensorTelemetryViewSchema = z.object({
  sensor_id: z.number().int(),
  site_id: z.number().int(),
  is_active: z.boolean(),
  last_heartbeat_at: isoDate.nullable(),
  last_ingest_at: isoDate.nullable(),
  flow_count: z.number().int(),
  last_link_degraded: z.boolean(),
  last_link_report_at: isoDate.nullable(),
})
export type SensorTelemetryView = z.infer<typeof sensorTelemetryViewSchema>

export const MAX_KNOWN_DEVICES = 512

export const siteConfigViewSchema = z.object({
  site_id: z.number().int(),
  custom_mse_threshold: z.number().nullable(),
  active_response_enabled: z.boolean(),
  informative_only_mode: z.boolean(),
  known_devices: z.array(z.string()), // CIDRs
})
export type SiteConfigView = z.infer<typeof siteConfigViewSchema>

/** Body parcial de PUT /sites/{id}/config. El backend responde 422 si viene vacío o con bool/lista en null. */
export const siteConfigUpdateSchema = z
  .object({
    custom_mse_threshold: z.number().positive().nullable().optional(),
    active_response_enabled: z.boolean().optional(),
    informative_only_mode: z.boolean().optional(),
    known_devices: z.array(z.string()).max(MAX_KNOWN_DEVICES).optional(),
  })
  .strict()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Hay que enviar al menos un campo",
  })
export type SiteConfigUpdate = z.infer<typeof siteConfigUpdateSchema>

export const manualReversionResponseSchema = z.object({
  site_id: z.number().int(),
  source_ip: z.string(),
  reverted: z.boolean(),
  rule_was_present: z.boolean(),
})
export type ManualReversionResponse = z.infer<typeof manualReversionResponseSchema>

export const quarantineViewSchema = z.object({
  source_ip: z.string(),
  destination_ip: z.string(),
  destination_port: z.number().int(),
  mse_score: z.number(),
  quarantined_at: isoDate,
  expires_at: isoDate,
})
export type QuarantineView = z.infer<typeof quarantineViewSchema>

export const criticalAlertViewSchema = z.object({
  source_ip: z.string(),
  destination_ip: z.string(),
  destination_port: z.number().int(),
  mse_score: z.number(),
  first_seen: isoDate,
  last_seen: isoDate,
  expires_at: isoDate,
})
export type CriticalAlertView = z.infer<typeof criticalAlertViewSchema>

export const dashboardStateSchema = z.object({
  active_quarantines: z.array(quarantineViewSchema),
  critical_alerts: z.array(criticalAlertViewSchema),
})
export type DashboardState = z.infer<typeof dashboardStateSchema>

export const healthResponseSchema = z.object({
  status: z.string(),
  ml_ready: z.boolean(),
  database_ready_at_startup: z.boolean(),
  logging_ready: z.boolean(),
})
export type HealthResponse = z.infer<typeof healthResponseSchema>

export const mitigationEventTypeSchema = z.enum(["APPLY", "REVERSION", "MANUAL_REVERSION"])
export type MitigationEventType = z.infer<typeof mitigationEventTypeSchema>

export const mitigationReasonSchema = z.enum([
  "quarantine_timer_elapsed",
  "administrator_manual_reversion",
  "legacy_quarantine_import",
])
export type MitigationReason = z.infer<typeof mitigationReasonSchema>

export const mitigationEventSchema = z.object({
  id: z.number().int(),
  site_id: z.number().int(),
  sensor_id: z.number().int().nullable(),
  event_type: mitigationEventTypeSchema,
  original_event_id: z.number().int().nullable(),
  source_ip: z.string(),
  destination_ip: z.string(),
  destination_port: z.number().int(),
  mse_score: z.number(),
  reason: mitigationReasonSchema.nullable(),
  occurred_at: isoDate,
})
export type MitigationEvent = z.infer<typeof mitigationEventSchema>

// --- Propuesto (no existe en el backend todavía) ----------------------------

/** GET /sites */
export const siteViewSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  is_active: z.boolean(),
  config: siteConfigViewSchema,
})
export type SiteView = z.infer<typeof siteViewSchema>

/** GET /sites/{site_id}/sensors */
export const siteSensorViewSchema = sensorTelemetryViewSchema.extend({
  name: z.string(),
})
export type SiteSensorView = z.infer<typeof siteSensorViewSchema>

/** GET /quarantines?site_id= (versión admin de /dashboard/state) */
export const adminQuarantineViewSchema = quarantineViewSchema.extend({
  site_id: z.number().int(),
})
export type AdminQuarantineView = z.infer<typeof adminQuarantineViewSchema>

/** GET /alerts con since/until/unrecognized_device y paginación por before_id */
export const alertsPageSchema = z.object({
  items: z.array(alertViewSchema),
  next_before_id: z.number().int().nullable(),
})
export type AlertsPage = z.infer<typeof alertsPageSchema>

/** GET /sites/{site_id}/summary?hours=24 */
export const siteSummarySchema = z.object({
  site_id: z.number().int(),
  hours: z.number().int(),
  total_alerts: z.number().int(),
  by_severity: z.object({
    warning: z.number().int(),
    high: z.number().int(),
    critical: z.number().int(),
  }),
  by_hour: z.array(z.object({ hour: isoDate, count: z.number().int() })),
  top_sources: z.array(z.object({ source_ip: z.string(), count: z.number().int() })),
  flows_analyzed: z.number().int(),
})
export type SiteSummary = z.infer<typeof siteSummarySchema>

/** GET /sensors/{sensor_id}/flows?limit=20 (RF-06) */
export const flowSampleSchema = z.object({
  source_ip: z.string(),
  destination_ip: z.string(),
  destination_port: z.number().int(),
  features: z.record(z.string(), z.number()),
})
export type FlowSample = z.infer<typeof flowSampleSchema>

// --- Error del BFF -----------------------------------------------------------

export const apiErrorBodySchema = z.object({ detail: z.string() })
