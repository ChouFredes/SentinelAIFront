import { describe, expect, it } from "vitest"
import { safeNext } from "@/lib/safe-next"

describe("safeNext", () => {
  it("acepta rutas internas", () => {
    expect(safeNext("/")).toBe("/")
    expect(safeNext("/alertas")).toBe("/alertas")
    expect(safeNext("/alertas?severidad=high&periodo=24h")).toBe("/alertas?severidad=high&periodo=24h")
    expect(safeNext("/alertas/1100")).toBe("/alertas/1100")
    expect(safeNext("/sitios/2#config")).toBe("/sitios/2#config")
  })

  it("rechaza URLs absolutas y esquemas", () => {
    for (const bad of [
      "https://evil.com",
      "http://evil.com/login",
      "javascript:alert(1)",
      "data:text/html,<script>1</script>",
      "mailto:a@b.c",
      "evil.com",
      "alertas",
    ]) {
      expect(safeNext(bad), bad).toBe("/")
    }
  })

  it("rechaza URLs relativas al protocolo", () => {
    for (const bad of ["//evil.com", "///evil.com", "//evil.com/alertas", "////evil.com"]) {
      expect(safeNext(bad), bad).toBe("/")
    }
  })

  it("rechaza cualquier barra invertida", () => {
    for (const bad of ["/\\evil.com", "/\\/evil.com", "/foo\\bar", "\\\\evil.com", "/alertas\\", "/%5C".replace("%5C", "\\")]) {
      expect(safeNext(bad), bad).toBe("/")
    }
  })

  it("rechaza caracteres de control que el navegador descarta", () => {
    for (const bad of ["/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/\u0000/evil.com", "/alertas\n", "/\u007f"]) {
      expect(safeNext(bad), bad).toBe("/")
    }
  })

  it("un %5C codificado queda como ruta del mismo origen (no es una barra)", () => {
    expect(safeNext("/%5Cevil.com")).toBe("/%5Cevil.com")
  })

  it("nunca vuelve a /login", () => {
    for (const bad of ["/login", "/login?next=/alertas", "/login/", "/login/otra"]) {
      expect(safeNext(bad), bad).toBe("/")
    }
    expect(safeNext("/loginx")).toBe("/loginx")
  })

  it("devuelve / para valores vacíos o que no son strings", () => {
    for (const bad of ["", null, undefined, 42, {}, ["/alertas"]]) {
      expect(safeNext(bad as unknown)).toBe("/")
    }
  })

  it("el resultado siempre es una ruta local", () => {
    const inputs = ["/", "//x", "/\\x", "https://x", "/a/../b", "/a?b=//c", "/a#//c", "/%2F%2Fevil.com"]
    for (const input of inputs) {
      const out = safeNext(input)
      expect(out.startsWith("/") && !out.startsWith("//") && !out.includes("\\"), `${input} → ${out}`).toBe(true)
    }
  })
})
