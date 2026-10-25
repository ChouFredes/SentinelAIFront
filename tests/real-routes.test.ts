import { afterEach, describe, expect, it } from "vitest"
import {
  TOKEN,
  backendSensor,
  backendSite,
  reply,
  restoreEnvironment,
  useMockMode,
  useRealBackend,
} from "./helpers/real-backend"

afterEach(restoreEnvironment)

const ctx = <T>(params: T) => ({ params: Promise.resolve(params) })
async function nextRequest(url: string) {
  const { NextRequest } = await import("next/server")
  return new NextRequest(url)
}

describe("BACKEND_SUPPORT", () => {
  it("los endpoints nuevos del backend están habilitados y flows sigue siendo mock", async () => {
    const { BACKEND_SUPPORT } = await import("@/lib/server/backend-support")
    for (const key of ["health", "alerts", "alertDetail", "siteConfig", "telemetry", "revert", "sites", "siteSensors", "mitigationEvents", "quarantines"] as const) {
      expect(BACKEND_SUPPORT[key], key).toBe(true)
    }
    expect(BACKEND_SUPPORT.flows).toBe(false)
  })

  it("shouldMock: con mocks todo es mock; en modo real solo lo que falta", async () => {
    useMockMode()
    let support = await import("@/lib/server/backend-support")
    expect(support.shouldMock("sites")).toBe(true)
    expect(support.shouldMock("flows")).toBe(true)
    await useRealBackend({})
    support = await import("@/lib/server/backend-support")
    expect(support.shouldMock("sites")).toBe(false)
    expect(support.shouldMock("quarantines")).toBe(false)
    expect(support.shouldMock("alertDetail")).toBe(false)
    expect(support.shouldMock("flows")).toBe(true)
  })
})

describe("GET /api/sites", () => {
  it("modo real: llama a /sites con el Bearer del servidor y normaliza las fechas", async () => {
    const { calls } = await useRealBackend({ "/sites": () => [backendSite(1, "Depósito central"), backendSite(2)] })
    const { GET } = await import("@/app/api/sites/route")
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.map((s: { name: string }) => s.name)).toEqual(["Depósito central", "Sitio 2"])
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ method: "GET", path: "/sites", auth: `Bearer ${TOKEN}` })
  })

  it("modo real: una respuesta con otro formato es un 502", async () => {
    await useRealBackend({ "/sites": () => [{ id: 1, name: "sin slug ni config" }] })
    const { GET } = await import("@/app/api/sites/route")
    expect((await GET()).status).toBe(502)
  })

  it("modo real: los errores del backend pasan con su status y mensaje", async () => {
    await useRealBackend({ "/sites": () => reply(503, { detail: "Site database is unavailable" }) })
    const { GET } = await import("@/app/api/sites/route")
    const res = await GET()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ detail: "Site database is unavailable" })
  })

  it("con mocks no llama al backend", async () => {
    const { fetchMock } = useMockMode()
    const { GET } = await import("@/app/api/sites/route")
    const res = await GET()
    expect(res.status).toBe(200)
    expect((await res.json()).length).toBeGreaterThan(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("GET /api/sites/{id}/sensors", () => {
  it("modo real: llama a /sites/{id}/sensors y acepta heartbeat nulo con fechas sin offset", async () => {
    const { calls } = await useRealBackend({ "/sites/2/sensors": () => [backendSensor(12, 2)] })
    const { GET } = await import("@/app/api/sites/[siteId]/sensors/route")
    const res = await GET(new Request("http://x"), ctx({ siteId: "2" }) as never)
    expect(res.status).toBe(200)
    const [sensor] = await res.json()
    expect(sensor).toMatchObject({ sensor_id: 12, name: "SN-0012", last_heartbeat_at: null, last_ingest_at: "2026-10-23T17:00:00.123456Z" })
    expect(calls[0]).toMatchObject({ path: "/sites/2/sensors", auth: `Bearer ${TOKEN}` })
  })

  it("modo real: el 404 'Site not found' pasa tal cual", async () => {
    await useRealBackend({ "/sites/99/sensors": () => reply(404, { detail: "Site not found" }) })
    const { GET } = await import("@/app/api/sites/[siteId]/sensors/route")
    const res = await GET(new Request("http://x"), ctx({ siteId: "99" }) as never)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ detail: "Site not found" })
  })

  it("un id que no es entero es 422 y no llama al backend", async () => {
    const { fetchMock } = await useRealBackend({})
    const { GET } = await import("@/app/api/sites/[siteId]/sensors/route")
    expect((await GET(new Request("http://x"), ctx({ siteId: "abc" }) as never)).status).toBe(422)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("con mocks: sitio conocido responde y uno inexistente es 404 como el backend", async () => {
    const { fetchMock } = useMockMode()
    const { GET } = await import("@/app/api/sites/[siteId]/sensors/route")
    const ok = await GET(new Request("http://x"), ctx({ siteId: "1" }) as never)
    expect(ok.status).toBe(200)
    expect((await ok.json()).length).toBeGreaterThan(0)
    expect((await GET(new Request("http://x"), ctx({ siteId: "99" }) as never)).status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("GET /api/mitigation-events", () => {
  const event = (id: number, over: Record<string, unknown> = {}) => ({
    id,
    site_id: 1,
    sensor_id: 7,
    event_type: "APPLY",
    original_event_id: null,
    source_ip: "203.0.113.45",
    destination_ip: "192.168.1.10",
    destination_port: 3389,
    mse_score: 0.0184,
    reason: null,
    occurred_at: "2026-10-23T17:10:33",
    ...over,
  })

  it("modo real: reenvía site_id, source_ip y limit, y acepta campos nulos y motivo libre", async () => {
    const { calls } = await useRealBackend({
      "/mitigation-events": () => [
        event(3, { event_type: "REVERSION", original_event_id: 2, reason: "motivo_nuevo", occurred_at: "2026-10-23T17:11:33+00:00" }),
        event(2, { sensor_id: null, destination_ip: null, destination_port: null, mse_score: null, reason: "legacy_quarantine_import" }),
      ],
    })
    const { GET } = await import("@/app/api/mitigation-events/route")
    const res = await GET(await nextRequest("http://x/api/mitigation-events?site_id=1&source_ip=203.0.113.45&limit=50"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[1]).toMatchObject({ destination_ip: null, destination_port: null, mse_score: null, reason: "legacy_quarantine_import" })
    expect(body[0].reason).toBe("motivo_nuevo")
    expect(calls[0].query).toEqual({ site_id: "1", source_ip: "203.0.113.45", limit: "50" })
    expect(calls[0].auth).toBe(`Bearer ${TOKEN}`)
  })

  it("no manda filtros que no se pidieron", async () => {
    const { calls } = await useRealBackend({ "/mitigation-events": () => [] })
    const { GET } = await import("@/app/api/mitigation-events/route")
    await GET(await nextRequest("http://x/api/mitigation-events"))
    expect(calls[0].query).toEqual({ limit: "200" })
  })

  it("una IP a medio escribir es 422 sin llamar al backend (en ambos modos)", async () => {
    const real = await useRealBackend({})
    let { GET } = await import("@/app/api/mitigation-events/route")
    for (const bad of ["192.168", "abc", "203.0.113.999"]) {
      const res = await GET(await nextRequest(`http://x/api/mitigation-events?source_ip=${bad}`))
      expect(res.status, bad).toBe(422)
    }
    expect(real.fetchMock).not.toHaveBeenCalled()
    restoreEnvironment()
    useMockMode()
    ;({ GET } = await import("@/app/api/mitigation-events/route"))
    expect((await GET(await nextRequest("http://x/api/mitigation-events?source_ip=192.168"))).status).toBe(422)
  })

  it("limit fuera de rango es 422", async () => {
    const { fetchMock } = await useRealBackend({})
    const { GET } = await import("@/app/api/mitigation-events/route")
    expect((await GET(await nextRequest("http://x/api/mitigation-events?limit=1001"))).status).toBe(422)
    expect((await GET(await nextRequest("http://x/api/mitigation-events?limit=0"))).status).toBe(422)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("con mocks no llama al backend", async () => {
    const { fetchMock } = useMockMode()
    const { GET } = await import("@/app/api/mitigation-events/route")
    const res = await GET(await nextRequest("http://x/api/mitigation-events?limit=5"))
    expect((await res.json()).length).toBe(5)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("GET /api/quarantines", () => {
  const quarantine = (siteId: number) => ({
    site_id: siteId,
    source_ip: "203.0.113.45",
    destination_ip: "192.168.1.10",
    destination_port: 3389,
    mse_score: 0.0184,
    quarantined_at: "2026-10-23T17:10:33.5",
    expires_at: "2026-10-23T17:11:33.5",
  })

  it("modo real: llama a /quarantines con site_id y valida la forma de la versión admin", async () => {
    const { calls } = await useRealBackend({ "/quarantines": () => [quarantine(2)] })
    const { GET } = await import("@/app/api/quarantines/route")
    const res = await GET(await nextRequest("http://x/api/quarantines?site_id=2"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ ...quarantine(2), quarantined_at: "2026-10-23T17:10:33.5Z", expires_at: "2026-10-23T17:11:33.5Z" }])
    expect(calls[0]).toMatchObject({ path: "/quarantines", query: { site_id: "2" }, auth: `Bearer ${TOKEN}` })
  })

  it("modo real: sin site_id pide todas; un item sin site_id es 502", async () => {
    const { calls } = await useRealBackend({ "/quarantines": () => [] })
    const { GET } = await import("@/app/api/quarantines/route")
    await GET(await nextRequest("http://x/api/quarantines"))
    expect(calls[0].query).toEqual({})

    await useRealBackend({ "/quarantines": () => [{ ...quarantine(1), site_id: undefined }] })
    const again = await import("@/app/api/quarantines/route")
    expect((await again.GET(await nextRequest("http://x/api/quarantines"))).status).toBe(502)
  })

  it("con mocks no llama al backend", async () => {
    const { fetchMock } = useMockMode()
    const { GET } = await import("@/app/api/quarantines/route")
    expect((await GET(await nextRequest("http://x/api/quarantines"))).status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("GET /api/sites/{id}/summary", () => {
  it("usa la lista real de sensores y suma su flow_count, sin llamar a /telemetry", async () => {
    const { calls } = await useRealBackend({
      "/sites/1/sensors": () => [backendSensor(7, 1, { flow_count: 1000 }), backendSensor(8, 1, { flow_count: 234 })],
      "/alerts": () => [],
    })
    const { GET } = await import("@/app/api/sites/[siteId]/summary/route")
    const res = await GET(await nextRequest("http://x/api/sites/1/summary?hours=24"), ctx({ siteId: "1" }) as never)
    expect(res.status).toBe(200)
    expect((await res.json()).flows_analyzed).toBe(1234)
    const paths = calls.map((c) => c.path)
    expect(paths).toContain("/sites/1/sensors")
    expect(paths).toContain("/alerts")
    expect(paths.some((p) => p.includes("telemetry"))).toBe(false)
    expect(calls.every((c) => c.auth === `Bearer ${TOKEN}`)).toBe(true)
  })

  it("si el backend no encuentra el sitio, el resumen es 404", async () => {
    await useRealBackend({ "/sites/9/sensors": () => reply(404, { detail: "Site not found" }), "/alerts": () => [] })
    const { GET } = await import("@/app/api/sites/[siteId]/summary/route")
    const res = await GET(await nextRequest("http://x/api/sites/9/summary"), ctx({ siteId: "9" }) as never)
    expect(res.status).toBe(404)
  })

  it("con mocks suma los flujos de los sensores simulados", async () => {
    const { fetchMock } = useMockMode()
    const { GET } = await import("@/app/api/sites/[siteId]/summary/route")
    const res = await GET(await nextRequest("http://x/api/sites/3/summary"), ctx({ siteId: "3" }) as never)
    expect((await res.json()).flows_analyzed).toBe(310_552 + 98_240)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
