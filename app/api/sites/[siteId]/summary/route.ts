import type { NextRequest } from "next/server"
import type { SiteSummary } from "@/lib/api/schemas"
import { loadAlerts } from "@/lib/server/alerts"
import { BackendError, handle } from "@/lib/server/errors"
import { intParam, pathInt } from "@/lib/server/params"
import { loadSiteSensors } from "@/lib/server/sites"
import { computeSummary } from "@/lib/server/summary"

export const dynamic = "force-dynamic"

// El resumen se calcula en el BFF a partir de /alerts y de los sensores del sitio
// (suma de flow_count) hasta que exista GET /sites/{id}/summary.
export function GET(req: NextRequest, ctx: RouteContext<"/api/sites/[siteId]/summary">) {
  return handle(async (): Promise<SiteSummary> => {
    const siteId = pathInt((await ctx.params).siteId, "siteId")
    const hours = intParam(req.nextUrl.searchParams, "hours") ?? 24
    if (hours < 1 || hours > 24 * 30) throw new BackendError(422, "hours debe estar entre 1 y 720")

    const [alerts, sensors] = await Promise.all([loadAlerts({ site_id: siteId }), loadSiteSensors(siteId)])
    const flows = sensors.reduce((total, sensor) => total + sensor.flow_count, 0)
    return computeSummary(alerts, siteId, hours, flows)
  })
}
