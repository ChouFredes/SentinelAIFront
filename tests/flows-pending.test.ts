import { afterEach, describe, expect, it } from "vitest"
import { reply, restoreEnvironment, useMockMode, useRealBackend } from "./helpers/real-backend"

afterEach(restoreEnvironment)

describe("flowsPending", () => {
  it("con SENTINEL_USE_MOCKS=true no hay nada pendiente: todo el panel es simulado", async () => {
    const { flowsPending } = await import("@/lib/server/backend-support")
    expect(flowsPending(true)).toBe(false)
  })

  it("en modo real los flujos quedan pendientes mientras el backend no los exponga", async () => {
    const { flowsPending, BACKEND_SUPPORT } = await import("@/lib/server/backend-support")
    expect(BACKEND_SUPPORT.flows).toBe(false)
    expect(flowsPending(false)).toBe(true)
  })

  it("deja de estar pendiente cuando el backend los expone", async () => {
    const { flowsPending } = await import("@/lib/server/backend-support")
    expect(flowsPending(false, { flows: true })).toBe(false)
    expect(flowsPending(true, { flows: true })).toBe(false)
    expect(flowsPending(false, { flows: false })).toBe(true)
  })
})

describe("layout del dashboard", () => {
  async function runtimeValue() {
    const { default: DashboardLayout } = await import("@/app/(dashboard)/layout")
    const element = DashboardLayout({ children: null }) as unknown as { props: { value: { mocks: boolean; flowsPending: boolean } } }
    return element.props.value
  }

  it("con mocks: todo simulado, sin aviso de flujos pendientes", async () => {
    useMockMode()
    expect(await runtimeValue()).toEqual({ mocks: true, flowsPending: false })
  })

  it("en modo real: los flujos quedan marcados como pendientes", async () => {
    await useRealBackend({})
    expect(await runtimeValue()).toEqual({ mocks: false, flowsPending: true })
  })
})

describe("GET /api/sensors/{id}/flows", () => {
  const ctx = (sensorId: string) => ({ params: Promise.resolve({ sensorId }) }) as never
  async function flows(sensorId: string, qs = "") {
    const { NextRequest } = await import("next/server")
    const { GET } = await import("@/app/api/sensors/[sensorId]/flows/route")
    return GET(new NextRequest(`http://x/api/sensors/${sensorId}/flows${qs}`), ctx(sensorId))
  }

  it("en modo real sigue respondiendo con la muestra de ejemplo, sin llamar al backend", async () => {
    const { fetchMock } = await useRealBackend({ "/sensors/7/flows": () => reply(500, { detail: "no debería llamarse" }) })
    const res = await flows("7", "?limit=3")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(3)
    expect(Object.keys(body[0].features).length).toBeGreaterThan(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("un sensor desconocido es 404 y un limit fuera de rango es 422", async () => {
    await useRealBackend({})
    expect((await flows("999")).status).toBe(404)
    expect((await flows("7", "?limit=0")).status).toBe(422)
    expect((await flows("7", "?limit=101")).status).toBe(422)
  })
})
