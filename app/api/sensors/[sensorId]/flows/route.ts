import type { NextRequest } from "next/server"
import { mockFlows } from "@/lib/api/mocks/store"
import { BackendError, handle } from "@/lib/server/errors"
import { intParam, pathInt } from "@/lib/server/params"

export const dynamic = "force-dynamic"

// GET /sensors/{id}/flows no existe en el backend todavía: siempre mock.
export function GET(req: NextRequest, ctx: RouteContext<"/api/sensors/[sensorId]/flows">) {
  return handle(async () => {
    const id = pathInt((await ctx.params).sensorId, "sensorId")
    const limit = intParam(req.nextUrl.searchParams, "limit") ?? 20
    if (limit < 1 || limit > 100) throw new BackendError(422, "limit debe estar entre 1 y 100")
    return mockFlows(id, limit)
  })
}
