import type { NextRequest } from "next/server"
import { mockQuarantines } from "@/lib/api/mocks/store"
import { handle } from "@/lib/server/errors"
import { intParam } from "@/lib/server/params"

export const dynamic = "force-dynamic"

// GET /quarantines no existe en el backend todavía (/dashboard/state solo acepta token de sensor): siempre mock.
export function GET(req: NextRequest) {
  return handle(async () => mockQuarantines(intParam(req.nextUrl.searchParams, "site_id")))
}
