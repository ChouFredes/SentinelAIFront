import { describe, expect, it } from "vitest"
import {
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  safeEqual,
  verifySessionToken,
} from "@/lib/session"

const SECRET = "x".repeat(40)

describe("session", () => {
  it("acepta un token recién creado", async () => {
    const token = await createSessionToken(SECRET)
    expect(await verifySessionToken(SECRET, token)).toBe(true)
  })

  it("rechaza un token vencido", async () => {
    const now = Date.now()
    const token = await createSessionToken(SECRET, now)
    const later = now + (SESSION_MAX_AGE_SECONDS + 1) * 1000
    expect(await verifySessionToken(SECRET, token, later)).toBe(false)
  })

  it("rechaza un token adulterado o firmado con otro secreto", async () => {
    const token = await createSessionToken(SECRET)
    const [exp, sig] = token.split(".")
    expect(await verifySessionToken(SECRET, `${Number(exp) + 100}.${sig}`)).toBe(false)
    expect(await verifySessionToken(SECRET, `${exp}.${"0".repeat(sig.length)}`)).toBe(false)
    expect(await verifySessionToken("y".repeat(40), token)).toBe(false)
  })

  it("rechaza tokens mal formados", async () => {
    for (const t of [undefined, "", "abc", "1.2.3", "x.y"]) {
      expect(await verifySessionToken(SECRET, t)).toBe(false)
    }
  })

  it("safeEqual compara strings", async () => {
    expect(await safeEqual("clave", "clave")).toBe(true)
    expect(await safeEqual("clave", "clavE")).toBe(false)
    expect(await safeEqual("a", "aa")).toBe(false)
  })
})
