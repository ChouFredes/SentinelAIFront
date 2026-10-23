// Todo fetch del navegador pasa por acá: habla solo con /api/* (el BFF) y valida con Zod.
import type { z } from "zod"
import { apiErrorBodySchema } from "@/lib/api/schemas"

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail)
    this.name = "ApiError"
  }
}

type Query = Record<string, string | number | boolean | null | undefined>

function buildUrl(path: string, query?: Query): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v))
  }
  const qs = sp.toString()
  return `/api${path}${qs ? `?${qs}` : ""}`
}

async function request<S extends z.ZodType>(
  url: string,
  schema: S,
  init?: RequestInit,
): Promise<z.infer<S>> {
  let res: Response
  try {
    res = await fetch(url, { ...init, headers: { Accept: "application/json", ...init?.headers } })
  } catch {
    throw new ApiError(0, "No se pudo conectar con el panel. Revisá tu conexión.")
  }

  if (res.status === 401 && typeof window !== "undefined") {
    const next = window.location.pathname + window.location.search
    // Navegación completa a propósito: descarta el estado de React Query de la sesión vencida.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login?next=${encodeURIComponent(next)}`)
    throw new ApiError(401, "Sesión vencida")
  }
  if (!res.ok) {
    const body = apiErrorBodySchema.safeParse(await res.json().catch(() => null))
    throw new ApiError(res.status, body.success ? body.data.detail : `Error ${res.status}`)
  }
  const parsed = schema.safeParse(await res.json())
  if (!parsed.success) {
    console.error("Respuesta inesperada de", url, parsed.error.issues)
    throw new ApiError(502, "El panel recibió una respuesta con formato inesperado")
  }
  return parsed.data
}

export function apiGet<S extends z.ZodType>(path: string, schema: S, query?: Query) {
  return request(buildUrl(path, query), schema)
}

export function apiSend<S extends z.ZodType>(
  path: string,
  method: "PUT" | "POST",
  schema: S,
  { body, query }: { body?: unknown; query?: Query } = {},
) {
  return request(buildUrl(path, query), schema, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}
