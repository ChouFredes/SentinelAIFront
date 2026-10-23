import { handle } from "@/lib/server/errors"
import { findAlert } from "@/lib/server/alerts"
import { pathInt } from "@/lib/server/params"

export const dynamic = "force-dynamic"

export function GET(_req: Request, ctx: RouteContext<"/api/alerts/[alertId]">) {
  return handle(async () => findAlert(pathInt((await ctx.params).alertId, "alertId")))
}
