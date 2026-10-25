import { z } from "zod"
import { mockSites } from "@/lib/api/mocks/store"
import { siteViewSchema } from "@/lib/api/schemas"
import { shouldMock } from "@/lib/server/backend-support"
import { handle } from "@/lib/server/errors"
import { sentinelFetch } from "@/lib/server/sentinel"

export const dynamic = "force-dynamic"

export function GET() {
  return handle(async () => {
    if (shouldMock("sites")) return mockSites()
    return sentinelFetch("/sites", z.array(siteViewSchema))
  })
}
