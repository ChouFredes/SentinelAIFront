import type {
  AdminQuarantineView,
  AlertView,
  MitigationEvent,
  Severity,
} from "@/lib/api/schemas"
import { parseIso } from "@/lib/format"

/** τ: umbral MSE global. */
export const TAU = 0.000308
/** Duración de la cuarentena por defecto, en segundos (solo lectura en la UI). */
export const QUARANTINE_SECONDS = 60
/** Una alerta es critical cuando MSE ≥ max(3τ, piso). */
export const CRITICAL_FACTOR = 3
/**
 * Una alerta y la cuarentena (o el APPLY) que disparó se registran casi en el
 * mismo instante; fuera de esta ventana son hechos distintos de la misma IP.
 */
export const QUARANTINE_MATCH_WINDOW_MS = 2_000

export function effectiveThreshold(customMseThreshold: number | null | undefined): number {
  return customMseThreshold ?? TAU
}

/**
 * Umbral desde el que una alerta es critical, como en el backend:
 * max(3·τ global, 3·umbral del sitio). Con umbral propio por debajo de τ manda 3τ.
 */
export function criticalThreshold(customMseThreshold: number | null | undefined): number {
  return Math.max(CRITICAL_FACTOR * TAU, CRITICAL_FACTOR * effectiveThreshold(customMseThreshold))
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
        Math.abs(Date.parse(e.occurred_at) - t) <= QUARANTINE_MATCH_WINDOW_MS,
    )
    if (apply) {
      const reversion = events.find((e) => e.original_event_id === apply.id)
      if (reversion?.event_type === "MANUAL_REVERSION") return "reverted_manual"
      if (reversion) return "reverted_timer"
    }
  }
  return "detected"
}

/**
 * La cuarentena vigente que originó esta alerta: mismo sitio e IP de origen,
 * registrada dentro de la ventana de la alerta y todavía sin vencer. Una alerta
 * anterior de una IP que hoy está en cuarentena no cuenta.
 */
export function findActiveQuarantine(
  alert: Pick<AlertView, "site_id" | "source_ip" | "occurred_at">,
  activeQuarantines: AdminQuarantineView[],
  now = Date.now(),
): AdminQuarantineView | undefined {
  const t = Date.parse(alert.occurred_at)
  return activeQuarantines.find(
    (q) =>
      q.site_id === alert.site_id &&
      q.source_ip === alert.source_ip &&
      Math.abs(Date.parse(q.quarantined_at) - t) <= QUARANTINE_MATCH_WINDOW_MS &&
      Date.parse(q.expires_at) > now,
  )
}

export function hasActiveQuarantine(
  alert: Pick<AlertView, "site_id" | "source_ip" | "occurred_at">,
  activeQuarantines: AdminQuarantineView[],
  now = Date.now(),
): boolean {
  return findActiveQuarantine(alert, activeQuarantines, now) !== undefined
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

/** Sin actividad (latido o envío de flujos) en 2 minutos = sin conexión. */
export const HEARTBEAT_TIMEOUT_MS = 120_000

/**
 * Última vez que el sensor dio señales de vida: la fecha más reciente entre el
 * latido y el último envío de flujos. El sensor Edge no llama a /heartbeat,
 * así que mirar solo el latido lo daría por caído.
 */
export function latestSensorActivity(s: {
  last_heartbeat_at: string | null
  last_ingest_at: string | null
}): string | null {
  const dates = [s.last_heartbeat_at, s.last_ingest_at].filter((d): d is string => d !== null)
  if (dates.length === 0) return null
  return dates.reduce((a, b) => (parseIso(b).getTime() > parseIso(a).getTime() ? b : a))
}

export function sensorStatus(
  s: {
    is_active: boolean
    last_heartbeat_at: string | null
    last_ingest_at: string | null
    last_link_degraded: boolean
  },
  now = Date.now(),
): SensorStatus {
  const last = latestSensorActivity(s)
  if (!s.is_active || last === null) return "offline"
  if (now - parseIso(last).getTime() > HEARTBEAT_TIMEOUT_MS) return "offline"
  return s.last_link_degraded ? "link_degraded" : "online"
}

/** "0,0004" o "0.0004" → número; "" → null (usa τ global); inválido o ≤ 0 → undefined. */
export function parseThreshold(raw: string): number | null | undefined {
  const t = raw.trim().replace(",", ".")
  if (t === "") return null
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? n : undefined
}
