import "server-only"
import { z } from "zod"

const blank = (v: unknown) => (v === "" ? undefined : v)

const envSchema = z
  .object({
    SENTINEL_API_URL: z.preprocess(blank, z.url().optional()),
    SENTINEL_ADMIN_TOKEN: z.preprocess(blank, z.string().min(32).max(512).optional()),
    PANEL_PASSWORD: z.string().min(1),
    SESSION_SECRET: z.string().min(32),
    SENTINEL_USE_MOCKS: z.preprocess(blank, z.enum(["true", "false"]).default("true")),
  })
  .superRefine((env, ctx) => {
    if (env.SENTINEL_USE_MOCKS === "true") return
    for (const key of ["SENTINEL_API_URL", "SENTINEL_ADMIN_TOKEN"] as const) {
      if (!env[key]) {
        ctx.addIssue({ code: "custom", path: [key], message: `${key} es obligatoria con SENTINEL_USE_MOCKS=false` })
      }
    }
  })

export interface Env {
  apiUrl: string | undefined
  adminToken: string | undefined
  panelPassword: string
  sessionSecret: string
  useMocks: boolean
}

let cached: Env | undefined

export function getEnv(): Env {
  if (cached) return cached
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
    throw new Error(`Variables de entorno inválidas: ${issues}`)
  }
  const e = parsed.data
  cached = {
    apiUrl: e.SENTINEL_API_URL?.replace(/\/+$/, ""),
    adminToken: e.SENTINEL_ADMIN_TOKEN,
    panelPassword: e.PANEL_PASSWORD,
    sessionSecret: e.SESSION_SECRET,
    useMocks: e.SENTINEL_USE_MOCKS === "true",
  }
  return cached
}
