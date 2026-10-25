// Simula el FastAPI con un `fetch` falso para probar el BFF en modo real
// (SENTINEL_USE_MOCKS=false) sin red ni backend.
import { vi } from "vitest"

export const TOKEN = "t".repeat(40)
export const BACKEND_URL = "http://backend.test"

export interface RecordedCall {
  method: string
  path: string
  query: Record<string, string>
  auth: string | null
  url: URL
}

type Handler = (call: RecordedCall, init: RequestInit | undefined) => unknown

/** Una respuesta explícita (status distinto de 200 o cuerpo no JSON). */
export function reply(status: number, body: unknown): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

export async function useRealBackend(handlers: Record<string, Handler>) {
  vi.resetModules()
  Object.assign(process.env, {
    PANEL_PASSWORD: "panel",
    SESSION_SECRET: "s".repeat(40),
    SENTINEL_USE_MOCKS: "false",
    SENTINEL_API_URL: BACKEND_URL,
    SENTINEL_ADMIN_TOKEN: TOKEN,
  })
  const calls: RecordedCall[] = []
  const fetchMock = vi.fn(async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input))
    const headers = new Headers(init?.headers)
    const call: RecordedCall = {
      method: init?.method ?? "GET",
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      auth: headers.get("authorization"),
      url,
    }
    calls.push(call)
    const handler = handlers[`${call.method} ${call.path}`] ?? handlers[call.path]
    if (!handler) return reply(404, { detail: `sin handler para ${call.method} ${call.path}` })
    const result = handler(call, init)
    return result instanceof Response ? result : reply(200, result)
  })
  vi.stubGlobal("fetch", fetchMock)
  return { calls, fetchMock }
}

export function useMockMode() {
  vi.resetModules()
  Object.assign(process.env, {
    PANEL_PASSWORD: "panel",
    SESSION_SECRET: "s".repeat(40),
    SENTINEL_USE_MOCKS: "true",
  })
  delete process.env.SENTINEL_API_URL
  delete process.env.SENTINEL_ADMIN_TOKEN
  const fetchMock = vi.fn(async () => reply(500, { detail: "no debería llamarse al backend" }))
  vi.stubGlobal("fetch", fetchMock)
  return { fetchMock }
}

export function restoreEnvironment() {
  vi.unstubAllGlobals()
  Object.assign(process.env, { SENTINEL_USE_MOCKS: "true" })
  delete process.env.SENTINEL_API_URL
  delete process.env.SENTINEL_ADMIN_TOKEN
  vi.resetModules()
}

// --- datos con la forma exacta de los modelos Pydantic (fechas naive, nulos) ---

export const siteConfig = (siteId: number) => ({
  site_id: siteId,
  custom_mse_threshold: null,
  active_response_enabled: true,
  informative_only_mode: false,
  known_devices: ["192.168.1.0/27"],
})

export const backendSite = (id: number, name = `Sitio ${id}`) => ({
  id,
  slug: `sitio-${id}`,
  name,
  is_active: true,
  config: siteConfig(id),
})

export const backendSensor = (id: number, siteId: number, over: Record<string, unknown> = {}) => ({
  sensor_id: id,
  site_id: siteId,
  name: `SN-${String(id).padStart(4, "0")}`,
  is_active: true,
  last_heartbeat_at: null, // el sensor Edge no llama a /heartbeat
  last_ingest_at: "2026-10-23T17:00:00.123456", // naive: UTC
  flow_count: 100,
  last_link_degraded: false,
  last_link_report_at: null,
  ...over,
})

export const backendAlert = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  site_id: 1,
  sensor_id: 7,
  source_ip: "203.0.113.45",
  destination_ip: "192.168.1.10",
  destination_port: 3389,
  mse_score: 0.0184,
  severity: "critical",
  anomaly: true,
  unrecognized_device: false,
  link_degraded: false,
  informative_only_mode: false,
  mitigation_applied: true,
  occurred_at: "2026-10-23T17:10:32.123456",
  ...over,
})
