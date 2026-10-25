import type { NextRequest } from "next/server"
import { z } from "zod"
import { mockMitigationEvents } from "@/lib/api/mocks/store"
import { mitigationEventSchema } from "@/lib/api/schemas"
import { shouldMock } from "@/lib/server/backend-support"
import { BackendError, handle } from "@/lib/server/errors"
import { intParam, ipParam } from "@/lib/server/params"
import { sentinelFetch } from "@/lib/server/sentinel"

export const dynamic = "force-dynamic"

// Historial de auditoría, más reciente primero. El backend no pagina: máximo 1000 eventos.
export function GET(req: NextRequest) {
  return handle(async () => {
    const sp = req.nextUrl.searchParams
    const limit = intParam(sp, "limit") ?? 200
    if (limit < 1 || limit > 1000) throw new BackendError(422, "limit debe estar entre 1 y 1000")
    const siteId = intParam(sp, "site_id")
    const sourceIp = ipParam(sp)
    if (shouldMock("mitigationEvents")) {
      return mockMitigationEvents({ site_id: siteId, source_ip: sourceIp, limit })
    }
    return sentinelFetch("/mitigation-events", z.array(mitigationEventSchema), {
      query: { site_id: siteId, source_ip: sourceIp, limit },
    })
  })
}
