import { sensorTelemetryViewSchema } from "@/lib/api/schemas"
import { mockTelemetry } from "@/lib/api/mocks/store"
import { shouldMock } from "@/lib/server/backend-support"
import { handle } from "@/lib/server/errors"
import { pathInt } from "@/lib/server/params"
import { sentinelFetch } from "@/lib/server/sentinel"

export const dynamic = "force-dynamic"

export function GET(_req: Request, ctx: RouteContext<"/api/sensors/[sensorId]/telemetry">) {
  return handle(async () => {
    const id = pathInt((await ctx.params).sensorId, "sensorId")
    if (shouldMock("telemetry")) return mockTelemetry(id)
    return sentinelFetch(`/sensors/${id}/telemetry`, sensorTelemetryViewSchema)
  })
}
