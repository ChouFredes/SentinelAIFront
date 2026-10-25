// Que la documentación no se desfase de lo que realmente es mock.
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { BACKEND_SUPPORT } from "@/lib/server/backend-support"

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

function section(markdown: string, heading: string): string {
  const start = markdown.indexOf(heading)
  expect(start, `falta la sección "${heading}"`).toBeGreaterThanOrEqual(0)
  const next = markdown.indexOf("\n## ", start + heading.length)
  return markdown.slice(start, next === -1 ? undefined : next)
}

describe("documentación del backend", () => {
  const claude = read("CLAUDE.md")
  const pending = read("docs/backend-pendiente.md")

  it("lo único que sigue siendo mock en BACKEND_SUPPORT es flows", () => {
    const mocked = Object.entries(BACKEND_SUPPORT).filter(([, supported]) => !supported).map(([key]) => key)
    expect(mocked).toEqual(["flows"])
  })

  it("CLAUDE.md: 'Faltante en backend' lista solo flows, summary y RF-08", () => {
    const missing = section(claude, "## Faltante en backend")
    const items = missing.split("\n").filter((line) => /^\d+\.\s/.test(line))
    expect(items).toHaveLength(3)
    expect(items[0]).toContain("/sensors/{sensor_id}/flows")
    expect(items[1]).toContain("/sites/{site_id}/summary")
    expect(items[2]).toContain("RF-08")
    for (const implemented of ["GET /sites`", "/sites/{site_id}/sensors", "/mitigation-events", "GET /quarantines"]) {
      expect(missing, implemented).not.toContain(implemented)
    }
  })

  it("CLAUDE.md: la tabla de la API incluye los endpoints ya implementados", () => {
    const api = section(claude, "## API existente")
    for (const route of ["`/alerts/{alert_id}`", "`/sites`", "`/sites/{site_id}/sensors`", "`/mitigation-events`", "`/quarantines`"]) {
      expect(api, route).toContain(route)
    }
    expect(api).toContain("`since`")
    expect(api).toContain("`until`")
    expect(api).toContain("`before_id`")
    expect(api).not.toContain("aún sin endpoint")
  })

  it("docs/backend-pendiente.md: lo pendiente son flows, summary y RF-08, y lo demás figura como integrado", () => {
    const todo = section(pending, "## Pendiente")
    expect(todo).toContain("/sensors/{sensor_id}/flows")
    expect(todo).toContain("/sites/{site_id}/summary")
    expect(todo).toContain("RF-08")
    for (const implemented of ["/sites`", "/sites/{id}/sensors", "/mitigation-events", "/quarantines", "/alerts/{id}"]) {
      expect(todo, implemented).not.toContain(implemented)
    }
    const done = section(pending, "## Ya integrado")
    for (const route of ["GET /sites`", "GET /sites/{id}/sensors", "GET /mitigation-events", "GET /quarantines", "GET /alerts/{id}", "before_id"]) {
      expect(done, route).toContain(route)
    }
  })
})
