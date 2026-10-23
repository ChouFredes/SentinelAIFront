import type { NextRequest } from "next/server"
import { mockMitigationEvents } from "@/lib/api/mocks/store"
import { BackendError, handle } from "@/lib/server/errors"
import { intParam } from "@/lib/server/params"

export const dynamic = "force-dynamic"

// GET /mitigation-events no existe en el backend todavía: siempre mock.
export function GET(req: NextRequest) {
  return handle(async () => {
    const sp = req.nextUrl.searchParams
    const limit = intParam(sp, "limit") ?? 200
    if (limit < 1 || limit > 1000) throw new BackendError(422, "limit debe estar entre 1 y 1000")
    return mockMitigationEvents({
      site_id: intParam(sp, "site_id"),
      source_ip: sp.get("source_ip") || undefined,
      limit,
    })
  })
}
