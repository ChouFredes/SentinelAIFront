import { healthResponseSchema, type HealthResponse } from "@/lib/api/schemas"
import { shouldMock } from "@/lib/server/backend-support"
import { handle } from "@/lib/server/errors"
import { sentinelFetch } from "@/lib/server/sentinel"

export const dynamic = "force-dynamic"

export function GET() {
  return handle(async (): Promise<HealthResponse> => {
    if (shouldMock("health")) {
      return { status: "ok", ml_ready: true, database_ready_at_startup: true, logging_ready: true }
    }
    return sentinelFetch("/health", healthResponseSchema)
  })
}
