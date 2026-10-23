import { describe, expect, it } from "vitest"
import {
  hostCidr,
  ipInCidr,
  ipInCidrs,
  isValidCidr,
  normalizeCidr,
  validateNewCidr,
} from "@/lib/cidr"

describe("cidr", () => {
  it("valida IPv4", () => {
    expect(isValidCidr("192.168.2.0/27")).toBe(true)
    expect(isValidCidr("0.0.0.0/0")).toBe(true)
    expect(isValidCidr("192.168.2.9/32")).toBe(true)
    for (const bad of ["192.168.2.0", "192.168.2.0/33", "256.1.1.1/8", "1.2.3/8", "1.2.3.4/", "a.b.c.d/8", "01.2.3.4/8", "1.2.3.4/8/9"]) {
      expect(isValidCidr(bad), bad).toBe(false)
    }
  })

  it("valida IPv6", () => {
    expect(isValidCidr("2001:db8::/32")).toBe(true)
    expect(isValidCidr("::1/128")).toBe(true)
    expect(isValidCidr("::ffff:192.168.1.1/128")).toBe(true)
    for (const bad of ["2001:db8::/129", "2001:db8:::1/64", "12345::/16", "1:2:3:4:5:6:7:8:9/64", "gggg::/16"]) {
      expect(isValidCidr(bad), bad).toBe(false)
    }
  })

  it("normaliza a la dirección de red", () => {
    expect(normalizeCidr("192.168.2.9/27")).toBe("192.168.2.0/27")
    expect(normalizeCidr(" 10.1.2.3/8 ")).toBe("10.0.0.0/8")
    expect(normalizeCidr("nope")).toBeNull()
  })

  it("chequea pertenencia", () => {
    expect(ipInCidr("192.168.2.30", "192.168.2.0/27")).toBe(true)
    expect(ipInCidr("192.168.2.32", "192.168.2.0/27")).toBe(false)
    expect(ipInCidr("192.168.2.9", "192.168.2.9/32")).toBe(true)
    expect(ipInCidr("2001:db8::5", "2001:db8::/32")).toBe(true)
    expect(ipInCidr("192.168.2.1", "2001:db8::/32")).toBe(false)
    expect(ipInCidrs("192.168.3.41", ["192.168.2.0/27", "192.168.3.0/27"])).toBe(false)
    expect(ipInCidrs("192.168.3.4", ["192.168.2.0/27", "192.168.3.0/27"])).toBe(true)
  })

  it("arma el /32 de un host", () => {
    expect(hostCidr("192.168.3.41")).toBe("192.168.3.41/32")
    expect(hostCidr("2001:db8::1")).toBe("2001:db8::1/128")
    expect(hostCidr("nope")).toBeNull()
  })

  it("valida duplicados y límite", () => {
    expect(validateNewCidr("192.168.2.5/27", ["192.168.2.0/27"])).toBe("duplicate")
    expect(validateNewCidr("x", [])).toBe("invalid")
    expect(validateNewCidr("10.0.0.0/8", ["192.168.2.0/27"])).toBeNull()
    const full = Array.from({ length: 512 }, (_, i) => `10.${i >> 8}.${i & 255}.0/24`)
    expect(validateNewCidr("172.16.0.0/12", full)).toBe("limit")
  })
})
