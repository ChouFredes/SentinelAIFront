import type {
  AdminQuarantineView,
  AlertView,
  MitigationEvent,
  Severity,
} from "@/lib/api/schemas"

/** τ: umbral MSE global. */
export const TAU = 0.000308
/** Duración de la cuarentena por defecto, en segundos (solo lectura en la UI). */
export const QUARANTINE_SECONDS = 60
/** Una alerta es critical cuando MSE ≥ max(3τ, piso). */
export const CRITICAL_FACTOR = 3

export function effectiveThreshold(customMseThreshold: number | null | undefined): number {
  return customMseThreshold ?? TAU
}

export function criticalThreshold(tau: number): number {
  return CRITICAL_FACTOR * tau
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  warning: "Advertencia",
  high: "Alta",
  critical: "Crítica",
}

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "warning"]

export function severityRank(s: Severity): number {
  return SEVERITY_ORDER.length - SEVERITY_ORDER.indexOf(s)
}

export type AlertState =
  | "quarantine_active"
  | "reverted_manual"
  | "reverted_timer"
  | "suspended_link"
  | "informative"
  | "detected"

export const ALERT_STATE_LABEL: Record<AlertState, string> = {
  quarantine_active: "Cuarentena activa",
  reverted_manual: "Revertida (manual)",
  reverted_timer: "Revertida (vencimiento)",
  suspended_link: "Suspendida: enlace degradado",
  informative: "Informativa",
  detected: "Detectada",
}

/**
 * Estado que muestra la tabla de alertas (wf1). Se deriva de los flags de la
 * alerta, las cuarentenas activas y el historial de mitigación; el backend no
 * expone un campo "estado".
 */
export function deriveAlertState(
  alert: AlertView,
  activeQuarantines: AdminQuarantineView[],
  events: MitigationEvent[],
): AlertState {
  if (hasActiveQuarantine(alert, activeQuarantines)) return "quarantine_active"
  if (alert.informative_only_mode) return "informative"
  if (alert.link_degraded && !alert.mitigation_applied) return "suspended_link"
  if (alert.mitigation_applied) {
    const t = Date.parse(alert.occurred_at)
    const apply = events.find(
      (e) =>
        e.event_type === "APPLY" &&
        e.site_id === alert.site_id &&
        e.source_ip === alert.source_ip &&
        Math.abs(Date.parse(e.occurred_at) - t) <= 5_000,
    )
    if (apply) {
      const reversion = events.find((e) => e.original_event_id === apply.id)
      if (reversion?.event_type === "MANUAL_REVERSION") return "reverted_manual"
      if (reversion) return "reverted_timer"
    }
  }
  return "detected"
}

export function hasActiveQuarantine(
  alert: Pick<AlertView, "site_id" | "source_ip">,
  activeQuarantines: AdminQuarantineView[],
  now = Date.now(),
): boolean {
  return activeQuarantines.some(
    (q) =>
      q.site_id === alert.site_id &&
      q.source_ip === alert.source_ip &&
      Date.parse(q.expires_at) > now,
  )
}

export type MitigationActor = "Motor" | "Temporizador" | "Administrador"

export function mitigationActor(e: MitigationEvent): MitigationActor {
  if (e.event_type === "APPLY") return "Motor"
  if (e.event_type === "MANUAL_REVERSION") return "Administrador"
  return "Temporizador"
}

export const MITIGATION_REASON_LABEL: Record<string, string> = {
  quarantine_timer_elapsed: "vencimiento del plazo",
  administrator_manual_reversion: "reversión manual del administrador",
  legacy_quarantine_import: "importación de cuarentena previa",
}

export const MITIGATION_EVENT_LABEL: Record<MitigationEvent["event_type"], string> = {
  APPLY: "APPLY: regla aplicada",
  REVERSION: "REVERSION (referencia al APPLY)",
  MANUAL_REVERSION: "MANUAL_REVERSION (referencia al APPLY)",
}

/** RF-06: qué viaja del sensor al motor. */
export const TRANSMITTED_FIELDS: { label: string; sent: boolean }[] = [
  { label: "Direcciones IP origen y destino", sent: true },
  { label: "Puertos y protocolo", sent: true },
  { label: "Duración del flujo", sent: true },
  { label: "Cantidad de paquetes y bytes", sent: true },
  { label: "Tiempos entre arribos (media, desvío)", sent: true },
  { label: "Banderas TCP (conteos)", sent: true },
  { label: "Contenido de los paquetes (carga útil)", sent: false },
  { label: "URLs, credenciales, archivos", sent: false },
]

export type SensorStatus = "online" | "link_degraded" | "offline"

export const SENSOR_STATUS_LABEL: Record<SensorStatus, string> = {
  online: "En línea",
  link_degraded: "Enlace degradado",
  offline: "Sin conexión",
}

/** Sin latido en 2 minutos = sin conexión. */
export const HEARTBEAT_TIMEOUT_MS = 120_000

export function sensorStatus(
  s: { is_active: boolean; last_heartbeat_at: string | null; last_link_degraded: boolean },
  now = Date.now(),
): SensorStatus {
  if (!s.is_active || !s.last_heartbeat_at) return "offline"
  if (now - Date.parse(s.last_heartbeat_at) > HEARTBEAT_TIMEOUT_MS) return "offline"
  return s.last_link_degraded ? "link_degraded" : "online"
}
