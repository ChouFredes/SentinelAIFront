import type { NextRequest } from "next/server"
import { handle } from "@/lib/server/errors"
import { queryAlerts } from "@/lib/server/alerts"

export const dynamic = "force-dynamic"

export function GET(request: NextRequest) {
  return handle(() => queryAlerts(request.nextUrl.searchParams))
}
