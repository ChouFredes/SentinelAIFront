// Sesión del panel: cookie "<exp>.<hmac>" firmada con HMAC-SHA256 (Web Crypto,
// así corre igual en el proxy y en los route handlers). No importa `server-only`
// porque la usa proxy.ts; el secreto siempre llega por parámetro.

export const SESSION_COOKIE = "sentinel_session"
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60

const encoder = new TextEncoder()

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("")
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)))
}

/** Comparación en tiempo constante (compara los SHA-256, que tienen largo fijo). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ])
  const x = new Uint8Array(ha)
  const y = new Uint8Array(hb)
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}

export async function createSessionToken(secret: string, now = Date.now()): Promise<string> {
  const exp = String(Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS)
  return `${exp}.${await hmacHex(secret, exp)}`
}

export async function verifySessionToken(
  secret: string,
  token: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!token) return false
  const [exp, sig, ...rest] = token.split(".")
  if (!exp || !sig || rest.length || !/^\d+$/.test(exp)) return false
  if (Number(exp) * 1000 <= now) return false
  return safeEqual(sig, await hmacHex(secret, exp))
}
