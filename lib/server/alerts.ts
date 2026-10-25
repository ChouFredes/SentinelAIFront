import "server-only"
import { z } from "zod"
import {
  alertViewSchema,
  severitySchema,
  type AlertView,
  type AlertsPage,
} from "@/lib/api/schemas"
import { mockAlerts } from "@/lib/api/mocks/store"
import { parseIso } from "@/lib/format"
import { shouldMock } from "@/lib/server/backend-support"
import { BackendError } from "@/lib/server/errors"
import { intParam, ipParam } from "@/lib/server/params"
import { sentinelFetch } from "@/lib/server/sentinel"

const MAX_LIMIT = 1000
const DEFAULT_PAGE = 50
/** Tope de filas que se recorren paginando por before_id (resumen del sitio). */
const MAX_ROWS = 5000

/** Filtros de GET /alerts. `since` es inclusivo y `until` exclusivo (ISO en UTC). */
export interface AlertFilters {
  site_id?: number
  sensor_id?: number
  source_ip?: string
  severity?: AlertView["severity"]
  since?: string
  until?: string
  unrecognized_device?: boolean
  before_id?: number
  limit: number
}

function positiveInt(sp: URLSearchParams, name: string): number | undefined {
  const value = intParam(sp, name)
  if (value !== undefined && value <= 0) throw new BackendError(422, `${name} debe ser mayor que 0`)
  return value
}

/** Una fecha ISO 8601; sin offset se toma como UTC, como hace el backend. Devuelve ISO en UTC. */
function dateParam(sp: URLSearchParams, name: string): string | undefined {
  const raw = sp.get(name)
  if (!raw) return undefined
  const t = parseIso(raw).getTime()
  if (Number.isNaN(t)) throw new BackendError(422, `${name} debe ser una fecha ISO 8601`)
  return new Date(t).toISOString()
}

export function parseFilters(sp: URLSearchParams): AlertFilters {
  const severity = sp.get("severity")
  if (severity && !severitySchema.safeParse(severity).success) {
    throw new BackendError(422, "severity inválida")
  }
  const limit = intParam(sp, "limit") ?? DEFAULT_PAGE
  if (limit < 1 || limit > MAX_LIMIT) throw new BackendError(422, `limit debe estar entre 1 y ${MAX_LIMIT}`)
  const since = dateParam(sp, "since")
  const until = dateParam(sp, "until")
  if (since && until && since >= until) throw new BackendError(422, "since debe ser anterior a until")
  return {
    site_id: positiveInt(sp, "site_id"),
    sensor_id: positiveInt(sp, "sensor_id"),
    source_ip: ipParam(sp),
    severity: (severity as AlertView["severity"] | null) ?? undefined,
    since,
    until,
    unrecognized_device: sp.get("unrecognized_device") === "true" ? true : undefined,
    before_id: positiveInt(sp, "before_id"),
    limit,
  }
}

/** Una página de alertas, más reciente primero: del backend, o de los mocks con la misma semántica de filtros. */
async function fetchAlerts(f: AlertFilters): Promise<AlertView[]> {
  if (!shouldMock("alerts")) {
    return sentinelFetch("/alerts", z.array(alertViewSchema), { query: { ...f } })
  }
  const since = f.since ? Date.parse(f.since) : undefined
  const until = f.until ? Date.parse(f.until) : undefined
  return mockAlerts({ site_id: f.site_id, sensor_id: f.sensor_id, source_ip: f.source_ip, severity: f.severity })
    .filter((a) => {
      const t = parseIso(a.occurred_at).getTime()
      return (
        (since === undefined || t >= since) &&
        (until === undefined || t < until) &&
        (!f.unrecognized_device || a.unrecognized_device) &&
        (f.before_id === undefined || a.id < f.before_id)
      )
    })
    .slice(0, f.limit)
}

/**
 * Página de alertas para el panel. El backend filtra y pagina (`since` inclusivo,
 * `until` exclusivo, `before_id`); no informa el total, así que si vinieron
 * exactamente `limit` filas se asume que hay más y el cursor es el id de la última.
 */
export async function queryAlerts(sp: URLSearchParams): Promise<AlertsPage> {
  const f = parseFilters(sp)
  const items = await fetchAlerts(f)
  return {
    items,
    next_before_id: items.length === f.limit ? items[items.length - 1].id : null,
  }
}

/** Todas las alertas de un sitio desde `since`, paginando por before_id (hasta MAX_ROWS filas). */
export async function loadAllAlerts(filters: { site_id?: number; since?: string }): Promise<AlertView[]> {
  const rows: AlertView[] = []
  let beforeId: number | undefined
  while (rows.length < MAX_ROWS) {
    const page = await fetchAlerts({ ...filters, limit: MAX_LIMIT, before_id: beforeId })
    rows.push(...page)
    if (page.length < MAX_LIMIT) break
    beforeId = page[page.length - 1].id
  }
  return rows
}

export async function findAlert(id: number): Promise<AlertView> {
  if (shouldMock("alertDetail")) {
    const alert = mockAlerts().find((a) => a.id === id)
    if (!alert) throw new BackendError(404, "Alert not found")
    return alert
  }
  return sentinelFetch(`/alerts/${id}`, alertViewSchema)
}
