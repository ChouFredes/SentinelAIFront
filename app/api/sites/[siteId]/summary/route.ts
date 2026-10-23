import type { NextRequest } from "next/server"
import { mockSiteSensors, mockTelemetry } from "@/lib/api/mocks/store"
import { sensorTelemetryViewSchema, type SiteSummary } from "@/lib/api/schemas"
import { shouldMock } from "@/lib/server/backend-support"
import { loadAlerts } from "@/lib/server/alerts"
import { BackendError, handle } from "@/lib/server/errors"
import { intParam, pathInt } from "@/lib/server/params"
import { sentinelFetch } from "@/lib/server/sentinel"
import { computeSummary } from "@/lib/server/summary"

export const dynamic = "force-dynamic"

// El resumen se calcula en el BFF a partir de /alerts (y la telemetría de los
// sensores) hasta que exista GET /sites/{id}/summary.
export function GET(req: NextRequest, ctx: RouteContext<"/api/sites/[siteId]/summary">) {
  return handle(async (): Promise<SiteSummary> => {
    const siteId = pathInt((await ctx.params).siteId, "siteId")
    const hours = intParam(req.nextUrl.searchParams, "hours") ?? 24
    if (hours < 1 || hours > 24 * 30) throw new BackendError(422, "hours debe estar entre 1 y 720")

    const alerts = await loadAlerts({ site_id: siteId })
    // La lista de sensores por sitio es mock; la telemetría es real si no hay mocks.
    const sensorIds = mockSiteSensors(siteId).map((s) => s.sensor_id)
    const flowCounts = await Promise.all(
      sensorIds.map(async (id) => {
        if (shouldMock("telemetry")) return mockTelemetry(id).flow_count
        return sentinelFetch(`/sensors/${id}/telemetry`, sensorTelemetryViewSchema)
          .then((t) => t.flow_count)
          .catch(() => 0)
      }),
    )
    return computeSummary(alerts, siteId, hours, flowCounts.reduce((a, b) => a + b, 0))
  })
}
