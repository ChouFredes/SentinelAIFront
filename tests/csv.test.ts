import { describe, expect, it } from "vitest"
import { csvCell, toCsv } from "@/lib/csv"

describe("csv", () => {
  it("escapa comas, comillas y saltos de línea", () => {
    expect(csvCell("a,b")).toBe('"a,b"')
    expect(csvCell('di "hola"')).toBe('"di ""hola"""')
    expect(csvCell("a\nb")).toBe('"a\nb"')
    expect(csvCell(null)).toBe("")
    expect(csvCell(0.0184)).toBe("0.0184")
    expect(csvCell(true)).toBe("true")
  })

  it("arma el archivo con BOM y CRLF", () => {
    expect(toCsv(["a", "b"], [[1, "x,y"]])).toBe('﻿a,b\r\n1,"x,y"\r\n')
  })
})
