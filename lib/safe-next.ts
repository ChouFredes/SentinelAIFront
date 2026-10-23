// Destino de redirección después del login (?next=). Solo se aceptan rutas del
// mismo origen; cualquier otra cosa vuelve a "/". Vive acá y no en actions.ts
// porque los archivos "use server" solo pueden exportar funciones async.

const FALLBACK = "/"
// Origen ficticio: si al resolver `raw` contra él cambia el origen, no era una ruta local.
const BASE = "http://sentinel.invalid"

export function safeNext(raw: unknown): string {
  if (typeof raw !== "string" || raw === "") return FALLBACK
  // Los navegadores tratan "\" como "/" ("/\evil.com" es "//evil.com") y descartan
  // tab, CR y LF dentro de la URL ("/\t/evil.com" también termina en "//evil.com").
  if (raw.includes("\\") || /[\u0000-\u001f\u007f]/.test(raw)) return FALLBACK
  if (!raw.startsWith("/") || raw.startsWith("//")) return FALLBACK

  let url: URL
  try {
    url = new URL(raw, BASE)
  } catch {
    return FALLBACK
  }
  if (url.origin !== BASE) return FALLBACK
  if (url.pathname === "/login" || url.pathname.startsWith("/login/")) return FALLBACK
  return `${url.pathname}${url.search}${url.hash}`
}
