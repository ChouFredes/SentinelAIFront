import { mockSites } from "@/lib/api/mocks/store"
import { handle } from "@/lib/server/errors"

export const dynamic = "force-dynamic"

// GET /sites no existe en el backend todavía: siempre mock.
export function GET() {
  return handle(async () => mockSites())
}
