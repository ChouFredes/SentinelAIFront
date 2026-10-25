import type { NextRequest } from "next/server"
import { z } from "zod"
import { mockQuarantines } from "@/lib/api/mocks/store"
import { adminQuarantineViewSchema } from "@/lib/api/schemas"
import { shouldMock } from "@/lib/server/backend-support"
import { handle } from "@/lib/server/errors"
import { intParam } from "@/lib/server/params"
import { sentinelFetch } from "@/lib/server/sentinel"

export const dynamic = "force-dynamic"

// Versión admin de /dashboard/state (que solo acepta token de sensor): cuarentenas vivas de todos los sitios.
export function GET(req: NextRequest) {
  return handle(async () => {
    const siteId = intParam(req.nextUrl.searchParams, "site_id")
    if (shouldMock("quarantines")) return mockQuarantines(siteId)
    return sentinelFetch("/quarantines", z.array(adminQuarantineViewSchema), { query: { site_id: siteId } })
  })
}
