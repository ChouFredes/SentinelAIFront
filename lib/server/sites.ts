import "server-only"
import { z } from "zod"
import { mockSiteSensors } from "@/lib/api/mocks/store"
import { siteSensorViewSchema, type SiteSensorView } from "@/lib/api/schemas"
import { shouldMock } from "@/lib/server/backend-support"
import { sentinelFetch } from "@/lib/server/sentinel"

/** Sensores de un sitio con su telemetría (GET /sites/{id}/sensors; 404 si el sitio no existe). */
export async function loadSiteSensors(siteId: number): Promise<SiteSensorView[]> {
  if (shouldMock("siteSensors")) return mockSiteSensors(siteId)
  return sentinelFetch(`/sites/${siteId}/sensors`, z.array(siteSensorViewSchema))
}
