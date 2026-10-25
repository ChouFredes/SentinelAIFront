import { afterEach, describe, expect, it } from "vitest"
import {
  TOKEN,
  backendAlert,
  reply,
  restoreEnvironment,
  useMockMode,
  useRealBackend,
  type RecordedCall,
} from "./helpers/real-backend"

afterEach(restoreEnvironment)

const ctx = <T>(params: T) => ({ params: Promise.resolve(params) })
async function get(path: string) {
  const { NextRequest } = await import("next/server")
  const { GET } = await import("@/app/api/alerts/route")
  return GET(new NextRequest(`http://x${path}`))
}

/** Un /alerts que se comporta como el backend: más reciente primero, since inclusivo, until exclusivo, before_id estricto. */
function alertsBackend(rows: ReturnType<typeof backendAlert>[]) {
  return (call: RecordedCall) => {
    const q = call.query
    const t = (iso: string) => Date.parse(/(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`)
    return rows
      .filter(
        (a) =>
          (!q.site_id || a.site_id === Number(q.site_id)) &&
          (!q.since || t(a.occurred_at) >= t(q.since)) &&
          (!q.until || t(a.occurred_at) < t(q.until)) &&
          (q.unrecognized_device !== "true" || a.unrecognized_device) &&
          (!q.before_id || a.id < Number(q.before_id)),
      )
      .sort((a, b) => b.id - a.id)
      .slice(0, Number(q.limit ?? 100))
  }
}

describe("GET /api/alerts (modo real)", () => {
  it("pasa los filtros al backend: since, until, unrecognized_device, before_id y limit", async () => {
    const { calls } = await useRealBackend({ "/alerts": () => [] })
    const res = await get(
      "/api/alerts?site_id=2&sensor_id=12&severity=high&source_ip=203.0.113.45&since=2026-10-23T10:00:00.000Z&until=2026-10-23T20:00:00.000Z&unrecognized_device=true&before_id=500&limit=25",
    )
    expect(res.status).toBe(200)
    expect(calls).toHaveLength(1)
    expect(calls[0].path).toBe("/alerts")
    expect(calls[0].auth).toBe(`Bearer ${TOKEN}`)
    expect(calls[0].query).toEqual({
      site_id: "2",
      sensor_id: "12",
      severity: "high",
      source_ip: "203.0.113.45",
      since: "2026-10-23T10:00:00.000Z",
      until: "2026-10-23T20:00:00.000Z",
      unrecognized_device: "true",
      before_id: "500",
      limit: "25",
    })
  })

  it("ya no pide 1000 y filtra en el BFF: solo manda lo que se pidió", async () => {
    const { calls } = await useRealBackend({ "/alerts": () => [] })
    await get("/api/alerts")
    expect(calls[0].query).toEqual({ limit: "50" })
    await get("/api/alerts?limit=10&unrecognized_device=false")
    expect(calls[1].query).toEqual({ limit: "10" })
  })

  it("since y until sin offset se mandan como UTC; con offset se convierten", async () => {
    const { calls } = await useRealBackend({ "/alerts": () => [] })
    await get("/api/alerts?since=2026-10-23T10:00:00&until=2026-10-23T11:30:00-03:00")
    expect(calls[0].query.since).toBe("2026-10-23T10:00:00.000Z")
    expect(calls[0].query.until).toBe("2026-10-23T14:30:00.000Z")
  })

  it("next_before_id es el id de la última fila cuando vienen exactamente `limit` filas", async () => {
    const rows = [5, 4, 3].map((id) => backendAlert(id))
    await useRealBackend({ "/alerts": () => rows })
    const page = await (await get("/api/alerts?limit=3")).json()
    expect(page.items.map((a: { id: number }) => a.id)).toEqual([5, 4, 3])
    expect(page.next_before_id).toBe(3)
  })

  it("next_before_id es null cuando vienen menos de `limit` filas, o ninguna", async () => {
    await useRealBackend({ "/alerts": () => [backendAlert(2), backendAlert(1)] })
    expect((await (await get("/api/alerts?limit=3")).json()).next_before_id).toBeNull()
    await useRealBackend({ "/alerts": () => [] })
    expect(await (await get("/api/alerts?limit=3")).json()).toEqual({ items: [], next_before_id: null })
  })

  it("se pagina hasta agotar las alertas sin repetidos ni huecos", async () => {
    const all = Array.from({ length: 23 }, (_, i) => backendAlert(100 - i, { occurred_at: `2026-10-23T1${i % 10}:00:00` }))
    const { calls } = await useRealBackend({ "/alerts": alertsBackend(all) })
    const ids: number[] = []
    let cursor: number | null = null
    for (let guard = 0; guard < 10; guard++) {
      const page: { items: { id: number }[]; next_before_id: number | null } = await (
        await get(`/api/alerts?limit=10${cursor ? `&before_id=${cursor}` : ""}`)
      ).json()
      ids.push(...page.items.map((a) => a.id))
      cursor = page.next_before_id
      if (cursor === null) break
    }
    expect(ids).toEqual(all.map((a) => a.id))
    expect(new Set(ids).size).toBe(23)
    expect(calls.map((c) => c.query.before_id)).toEqual([undefined, "91", "81"])
  })

  it("until es exclusivo y since inclusivo (lo resuelve el backend; el BFF no filtra de nuevo)", async () => {
    const rows = [
      backendAlert(3, { occurred_at: "2026-10-23T12:00:00" }),
      backendAlert(2, { occurred_at: "2026-10-23T11:00:00" }),
      backendAlert(1, { occurred_at: "2026-10-23T10:00:00" }),
    ]
    await useRealBackend({ "/alerts": alertsBackend(rows) })
    const ids = async (qs: string) => (await (await get(`/api/alerts?limit=10&${qs}`)).json()).items.map((a: { id: number }) => a.id)
    expect(await ids("since=2026-10-23T11:00:00Z&until=2026-10-23T12:00:00Z")).toEqual([2])
    expect(await ids("since=2026-10-23T11:00:00Z")).toEqual([3, 2])
    expect(await ids("until=2026-10-23T11:00:00Z")).toEqual([1])
  })

  it("since >= until es 422 y no llama al backend", async () => {
    const { fetchMock } = await useRealBackend({ "/alerts": () => [] })
    expect((await get("/api/alerts?since=2026-10-23T12:00:00Z&until=2026-10-23T12:00:00Z")).status).toBe(422)
    expect((await get("/api/alerts?since=2026-10-23T13:00:00Z&until=2026-10-23T12:00:00Z")).status).toBe(422)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("parámetros inválidos son 422 sin llamar al backend", async () => {
    const { fetchMock } = await useRealBackend({ "/alerts": () => [] })
    for (const qs of ["since=ayer", "until=x", "source_ip=192.168", "severity=low", "limit=0", "limit=1001", "before_id=0", "before_id=abc", "site_id=-1"]) {
      expect((await get(`/api/alerts?${qs}`)).status, qs).toBe(422)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("los errores del backend pasan, y una respuesta mal formada es 502", async () => {
    await useRealBackend({ "/alerts": () => reply(503, { detail: "Alert database is unavailable" }) })
    const res = await get("/api/alerts")
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ detail: "Alert database is unavailable" })
    await useRealBackend({ "/alerts": () => [{ id: 1 }] })
    expect((await get("/api/alerts")).status).toBe(502)
  })

  it("normaliza las fechas sin offset de la respuesta a UTC", async () => {
    await useRealBackend({ "/alerts": () => [backendAlert(1, { occurred_at: "2026-10-23T17:10:32.5" })] })
    expect((await (await get("/api/alerts?limit=5")).json()).items[0].occurred_at).toBe("2026-10-23T17:10:32.5Z")
  })
})

describe("GET /api/alerts/{id} (modo real)", () => {
  async function detail(id: string) {
    const { GET } = await import("@/app/api/alerts/[alertId]/route")
    return GET(new Request("http://x"), ctx({ alertId: id }) as never)
  }

  it("llama a /alerts/{id} y no recorre la lista", async () => {
    const { calls } = await useRealBackend({ "/alerts/42": () => backendAlert(42) })
    const res = await detail("42")
    expect(res.status).toBe(200)
    expect((await res.json()).id).toBe(42)
    expect(calls.map((c) => c.path)).toEqual(["/alerts/42"])
    expect(calls[0].auth).toBe(`Bearer ${TOKEN}`)
  })

  it("propaga el 404 del backend", async () => {
    await useRealBackend({ "/alerts/7": () => reply(404, { detail: "Alert not found" }) })
    const res = await detail("7")
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ detail: "Alert not found" })
  })

  it("un id que no es entero es 422 sin llamar al backend", async () => {
    const { fetchMock } = await useRealBackend({})
    expect((await detail("abc")).status).toBe(422)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("modo mock: la misma semántica de filtros", () => {
  async function page(qs: string) {
    return (await get(`/api/alerts?${qs}`)).json() as Promise<{ items: { id: number; occurred_at: string; unrecognized_device: boolean }[]; next_before_id: number | null }>
  }

  it("since es inclusivo y until exclusivo, justo en el borde", async () => {
    const { fetchMock } = useMockMode()
    const all = (await page("limit=1000")).items
    const edge = all[Math.floor(all.length / 2)]
    const at = edge.occurred_at
    expect((await page(`limit=1000&since=${at}`)).items.map((a) => a.id)).toContain(edge.id)
    expect((await page(`limit=1000&until=${at}`)).items.map((a) => a.id)).not.toContain(edge.id)
    const next = new Date(Date.parse(at) + 1).toISOString()
    expect((await page(`limit=1000&until=${next}`)).items.map((a) => a.id)).toContain(edge.id)
    const justAfter = (await page(`limit=1000&since=${next}`)).items.map((a) => a.id)
    expect(justAfter).not.toContain(edge.id)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("unrecognized_device=true solo devuelve dispositivos no reconocidos", async () => {
    useMockMode()
    const { items } = await page("limit=1000&unrecognized_device=true")
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((a) => a.unrecognized_device)).toBe(true)
  })

  it("pagina completo con before_id sin repetidos ni huecos, y next_before_id sigue la regla de `limit` filas", async () => {
    useMockMode()
    const all = (await page("limit=1000")).items.map((a) => a.id)
    const ids: number[] = []
    let cursor: number | null = null
    let sawFull = false
    for (let guard = 0; guard < 50; guard++) {
      const p = await page(`limit=17${cursor ? `&before_id=${cursor}` : ""}`)
      ids.push(...p.items.map((a) => a.id))
      if (p.items.length === 17) {
        sawFull = true
        expect(p.next_before_id).toBe(p.items[16].id)
      } else {
        expect(p.next_before_id).toBeNull()
      }
      cursor = p.next_before_id
      if (cursor === null) break
    }
    expect(sawFull).toBe(true)
    expect(ids).toEqual(all)
    expect(new Set(ids).size).toBe(all.length)
  })

  it("el detalle de una alerta inexistente es 404 y el de una existente responde", async () => {
    useMockMode()
    const [first] = (await page("limit=1")).items
    const { GET } = await import("@/app/api/alerts/[alertId]/route")
    expect((await GET(new Request("http://x"), ctx({ alertId: String(first.id) }) as never)).status).toBe(200)
    expect((await GET(new Request("http://x"), ctx({ alertId: "999999" }) as never)).status).toBe(404)
  })

  it("también valida los parámetros (IP incompleta, since >= until)", async () => {
    useMockMode()
    expect((await get("/api/alerts?source_ip=192.168")).status).toBe(422)
    expect((await get("/api/alerts?since=2026-10-23T12:00:00Z&until=2026-10-23T11:00:00Z")).status).toBe(422)
  })
})

describe("resumen: alertas del período paginadas por before_id", () => {
  it("modo real: pide since y sigue paginando mientras vengan 1000 filas", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => backendAlert(3000 - i))
    const page2 = Array.from({ length: 250 }, (_, i) => backendAlert(2000 - i))
    const { calls } = await useRealBackend({
      "/alerts": (call) => (call.query.before_id ? page2 : page1),
      "/sites/1/sensors": () => [],
    })
    const { NextRequest } = await import("next/server")
    const { GET } = await import("@/app/api/sites/[siteId]/summary/route")
    const res = await GET(new NextRequest("http://x/api/sites/1/summary?hours=24"), ctx({ siteId: "1" }) as never)
    expect(res.status).toBe(200)
    const alertCalls = calls.filter((c) => c.path === "/alerts")
    expect(alertCalls).toHaveLength(2)
    expect(alertCalls[0].query).toMatchObject({ site_id: "1", limit: "1000" })
    expect(Date.parse(alertCalls[0].query.since)).toBeGreaterThan(Date.now() - 25 * 3_600_000)
    expect(Date.parse(alertCalls[0].query.since)).toBeLessThan(Date.now() - 23 * 3_600_000)
    expect(alertCalls[0].query.before_id).toBeUndefined()
    expect(alertCalls[1].query.before_id).toBe("2001")
  })

  it("se detiene en el tope de filas aunque el backend siga devolviendo páginas completas", async () => {
    let id = 100_000
    const { calls } = await useRealBackend({
      "/alerts": () => Array.from({ length: 1000 }, () => backendAlert(id--)),
      "/sites/1/sensors": () => [],
    })
    const { NextRequest } = await import("next/server")
    const { GET } = await import("@/app/api/sites/[siteId]/summary/route")
    expect((await GET(new NextRequest("http://x/api/sites/1/summary"), ctx({ siteId: "1" }) as never)).status).toBe(200)
    expect(calls.filter((c) => c.path === "/alerts")).toHaveLength(5)
  })
})
