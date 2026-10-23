import { mockSiteSensors } from "@/lib/api/mocks/store"
import { handle } from "@/lib/server/errors"
import { pathInt } from "@/lib/server/params"

export const dynamic = "force-dynamic"

// GET /sites/{id}/sensors no existe en el backend todavía: siempre mock.
export function GET(_req: Request, ctx: RouteContext<"/api/sites/[siteId]/sensors">) {
  return handle(async () => mockSiteSensors(pathInt((await ctx.params).siteId, "siteId")))
}
