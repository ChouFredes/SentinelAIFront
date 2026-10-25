import { handle } from "@/lib/server/errors"
import { pathInt } from "@/lib/server/params"
import { loadSiteSensors } from "@/lib/server/sites"

export const dynamic = "force-dynamic"

export function GET(_req: Request, ctx: RouteContext<"/api/sites/[siteId]/sensors">) {
  return handle(async () => loadSiteSensors(pathInt((await ctx.params).siteId, "siteId")))
}
