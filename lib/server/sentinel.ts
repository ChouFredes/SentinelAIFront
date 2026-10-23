import "server-only"
import type { z } from "zod"
import { getEnv } from "@/lib/server/env"
import { BackendError } from "@/lib/server/errors"

const TIMEOUT_MS = 10_000

interface Options {
  method?: "GET" | "PUT" | "POST"
  query?: Record<string, string | number | boolean | null | undefined>
  body?: unknown
}

/** Llama al FastAPI con el token admin (que nunca sale del servidor) y valida la respuesta con Zod. */
export async function sentinelFetch<S extends z.ZodType>(
  path: string,
  schema: S,
  { method = "GET", query, body }: Options = {},
): Promise<z.infer<S>> {
  const env = getEnv()
  if (!env.apiUrl || !env.adminToken) {
    throw new BackendError(503, "El backend no está configurado")
  }
  const url = new URL(`${env.apiUrl}${path}`)
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v))
  }

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${env.adminToken}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new BackendError(502, "No se pudo conectar con el backend")
  }

  if (!res.ok) {
    // FastAPI manda { detail: string | [...] }; pasamos 404/409/422/503 tal cual.
    let detail = `El backend respondió ${res.status}`
    try {
      const data = (await res.json()) as { detail?: unknown }
      if (typeof data.detail === "string") detail = data.detail
      else if (Array.isArray(data.detail)) {
        detail = data.detail
          .map((d: { msg?: string }) => d?.msg)
          .filter(Boolean)
          .join("; ") || detail
      }
    } catch {
      /* cuerpo no JSON */
    }
    throw new BackendError(res.status, detail)
  }

  const parsed = schema.safeParse(await res.json())
  if (!parsed.success) {
    console.error("[bff] respuesta inesperada de", path, parsed.error.issues)
    throw new BackendError(502, "El backend devolvió una respuesta con formato inesperado")
  }
  return parsed.data
}
