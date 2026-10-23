import type { NextRequest } from "next/server"
import { manualReversionResponseSchema } from "@/lib/api/schemas"
import { mockRevert } from "@/lib/api/mocks/store"
import { shouldMock } from "@/lib/server/backend-support"
import { handle } from "@/lib/server/errors"
import { intParam } from "@/lib/server/params"
import { sentinelFetch } from "@/lib/server/sentinel"

export const dynamic = "force-dynamic"

export function POST(req: NextRequest, ctx: RouteContext<"/api/quarantines/[sourceIp]/revert">) {
  return handle(async () => {
    const sourceIp = decodeURIComponent((await ctx.params).sourceIp)
    const siteId = intParam(req.nextUrl.searchParams, "site_id")
    if (shouldMock("revert")) return mockRevert(sourceIp, siteId)
    return sentinelFetch(
      `/quarantines/${encodeURIComponent(sourceIp)}/revert`,
      manualReversionResponseSchema,
      { method: "POST", query: { site_id: siteId } },
    )
  })
}
