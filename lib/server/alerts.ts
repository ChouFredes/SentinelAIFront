import "server-only"
import { z } from "zod"
import { alertViewSchema, severitySchema, type AlertView, type AlertsPage } from "@/lib/api/schemas"
import { mockAlerts } from "@/lib/api/mocks/store"
import { shouldMock } from "@/lib/server/backend-support"
import { BackendError } from "@/lib/server/errors"
import { intParam } from "@/lib/server/params"
import { sentinelFetch } from "@/lib/server/sentinel"

const MAX_LIMIT = 1000
const DEFAULT_PAGE = 50

interface AlertFilters {
  site_id?: number
  sensor_id?: number
  source_ip?: string
  severity?: AlertView["severity"]
  since?: number
  until?: number
  unrecognized_device?: boolean
  before_id?: number
  limit: number
}

function parseFilters(sp: URLSearchParams): AlertFilters {
  const severity = sp.get("severity")
  if (severity && !severitySchema.safeParse(severity).success) {
    throw new BackendError(422, "severity inválida")
  }
  const date = (name: string) => {
    const v = sp.get(name)
    if (!v) return undefined
    const t = Date.parse(v)
    if (Number.isNaN(t)) throw new BackendError(422, `${name} debe ser una fecha ISO 8601`)
    return t
  }
  const limit = intParam(sp, "limit") ?? DEFAULT_PAGE
  if (limit < 1 || limit > MAX_LIMIT) throw new BackendError(422, `limit debe estar entre 1 y ${MAX_LIMIT}`)
  return {
    site_id: intParam(sp, "site_id"),
    sensor_id: intParam(sp, "sensor_id"),
    source_ip: sp.get("source_ip") || undefined,
    severity: (severity as AlertView["severity"] | null) ?? undefined,
    since: date("since"),
    until: date("until"),
    unrecognized_device: sp.get("unrecognized_device") === "true" ? true : undefined,
    before_id: intParam(sp, "before_id"),
    limit,
  }
}

/**
 * Trae las alertas (más reciente primero). Contra el backend real se piden hasta
 * 1000 con los filtros que /alerts sí soporta; el resto se aplica en queryAlerts.
 */
export async function loadAlerts(filters: Pick<AlertFilters, "site_id" | "sensor_id" | "source_ip" | "severity">) {
  if (shouldMock("alerts")) return mockAlerts(filters)
  return sentinelFetch("/alerts", z.array(alertViewSchema), {
    query: { ...filters, limit: MAX_LIMIT },
  })
}

/** Paliativo hasta que /alerts soporte since/until/unrecognized_device/paginación (docs/backend-pendiente.md). */
export async function queryAlerts(sp: URLSearchParams): Promise<AlertsPage> {
  const f = parseFilters(sp)
  const all = await loadAlerts(f)
  const filtered = all.filter(
    (a) =>
      (f.since === undefined || Date.parse(a.occurred_at) >= f.since) &&
      (f.until === undefined || Date.parse(a.occurred_at) <= f.until) &&
      (!f.unrecognized_device || a.unrecognized_device) &&
      (f.before_id === undefined || a.id < f.before_id),
  )
  const items = filtered.slice(0, f.limit)
  const hasMore = filtered.length > items.length
  return { items, next_before_id: hasMore ? items[items.length - 1].id : null }
}

export async function findAlert(id: number): Promise<AlertView> {
  const alert = (await loadAlerts({})).find((a) => a.id === id)
  if (!alert) throw new BackendError(404, "Alerta no encontrada")
  return alert
}
