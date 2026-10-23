import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { resetMockStore, mockQuarantines } from "@/lib/api/mocks/store"

beforeAll(() => {
  Object.assign(process.env, {
    PANEL_PASSWORD: "panel",
    SESSION_SECRET: "s".repeat(40),
    SENTINEL_USE_MOCKS: "true",
  })
})
beforeEach(() => resetMockStore())

const ctx = <T>(params: T) => ({ params: Promise.resolve(params) })
const json = (body: unknown) =>
  new Request("http://x/api", { method: "PUT", body: JSON.stringify(body), headers: { "content-type": "application/json" } })

describe("route handlers (mocks)", () => {
  it("PUT config con body vacío → 422", async () => {
    const { PUT } = await import("@/app/api/sites/[siteId]/config/route")
    const res = await PUT(json({}), ctx({ siteId: "1" }) as never)
    expect(res.status).toBe(422)
  })

  it("PUT config con bool null o umbral <= 0 → 422", async () => {
    const { PUT } = await import("@/app/api/sites/[siteId]/config/route")
    expect((await PUT(json({ informative_only_mode: null }), ctx({ siteId: "1" }) as never)).status).toBe(422)
    expect((await PUT(json({ custom_mse_threshold: 0 }), ctx({ siteId: "1" }) as never)).status).toBe(422)
    expect((await PUT(json({ otro: 1 }), ctx({ siteId: "1" }) as never)).status).toBe(422)
  })

  it("PUT config válido → 200", async () => {
    const { PUT } = await import("@/app/api/sites/[siteId]/config/route")
    const res = await PUT(json({ active_response_enabled: false }), ctx({ siteId: "1" }) as never)
    expect(res.status).toBe(200)
    expect((await res.json()).active_response_enabled).toBe(false)
  })

  it("revert: 200 la primera vez, 404 la segunda", async () => {
    const { POST } = await import("@/app/api/quarantines/[sourceIp]/revert/route")
    const { NextRequest } = await import("next/server")
    const q = mockQuarantines()[0]
    const mk = () => new NextRequest(`http://x/api/quarantines/${q.source_ip}/revert?site_id=${q.site_id}`, { method: "POST" })
    expect((await POST(mk(), ctx({ sourceIp: q.source_ip }) as never)).status).toBe(200)
    expect((await POST(mk(), ctx({ sourceIp: q.source_ip }) as never)).status).toBe(404)
  })

  it("alerts: filtra y pagina por before_id", async () => {
    const { GET } = await import("@/app/api/alerts/route")
    const { NextRequest } = await import("next/server")
    const page1 = await (await GET(new NextRequest("http://x/api/alerts?limit=10&site_id=1"))).json()
    expect(page1.items).toHaveLength(10)
    expect(page1.items.every((a: { site_id: number }) => a.site_id === 1)).toBe(true)
    const page2 = await (await GET(new NextRequest(`http://x/api/alerts?limit=10&site_id=1&before_id=${page1.next_before_id}`))).json()
    expect(Math.max(...page2.items.map((a: { id: number }) => a.id))).toBeLessThan(page1.next_before_id)
    const bad = await GET(new NextRequest("http://x/api/alerts?limit=5000"))
    expect(bad.status).toBe(422)
  })

  it("alerts: unrecognized_device=true", async () => {
    const { GET } = await import("@/app/api/alerts/route")
    const { NextRequest } = await import("next/server")
    const page = await (await GET(new NextRequest("http://x/api/alerts?unrecognized_device=true&limit=1000"))).json()
    expect(page.items.length).toBeGreaterThan(0)
    expect(page.items.every((a: { unrecognized_device: boolean }) => a.unrecognized_device)).toBe(true)
  })

  it("alerta inexistente → 404", async () => {
    const { GET } = await import("@/app/api/alerts/[alertId]/route")
    expect((await GET(new Request("http://x"), ctx({ alertId: "99999" }) as never)).status).toBe(404)
  })
})
