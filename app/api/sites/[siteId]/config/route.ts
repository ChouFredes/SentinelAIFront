import { z } from "zod"
import {
  siteConfigUpdateSchema,
  siteConfigViewSchema,
} from "@/lib/api/schemas"
import { mockSiteConfig, mockUpdateSiteConfig } from "@/lib/api/mocks/store"
import { shouldMock } from "@/lib/server/backend-support"
import { BackendError, handle } from "@/lib/server/errors"
import { pathInt } from "@/lib/server/params"
import { sentinelFetch } from "@/lib/server/sentinel"

export const dynamic = "force-dynamic"

export function GET(_req: Request, ctx: RouteContext<"/api/sites/[siteId]/config">) {
  return handle(async () => {
    const siteId = pathInt((await ctx.params).siteId, "siteId")
    if (shouldMock("siteConfig")) return mockSiteConfig(siteId)
    return sentinelFetch(`/sites/${siteId}/config`, siteConfigViewSchema)
  })
}

export function PUT(req: Request, ctx: RouteContext<"/api/sites/[siteId]/config">) {
  return handle(async () => {
    const siteId = pathInt((await ctx.params).siteId, "siteId")
    const body: unknown = await req.json().catch(() => {
      throw new BackendError(422, "El cuerpo debe ser JSON")
    })
    const parsed = siteConfigUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw new BackendError(422, z.prettifyError(parsed.error))
    }
    if (shouldMock("siteConfig")) return mockUpdateSiteConfig(siteId, parsed.data)
    return sentinelFetch(`/sites/${siteId}/config`, siteConfigViewSchema, {
      method: "PUT",
      body: parsed.data,
    })
  })
}
