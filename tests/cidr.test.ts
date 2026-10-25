import { describe, expect, it } from "vitest"
import {
  hostCidr,
  ipInCidr,
  ipInCidrs,
  isPrivateIp,
  isValidIp,
  isQuarantinable,
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

describe("isQuarantinable", () => {
  it("las IP públicas y las privadas se pueden aislar", () => {
    for (const ip of ["203.0.113.45", "8.8.8.8", "192.168.1.66", "10.0.4.18", "172.16.5.9", "100.64.0.1"]) {
      expect(isQuarantinable(ip), ip).toBe(true)
    }
  })

  it("loopback, no especificada, multicast y link-local se rechazan", () => {
    for (const ip of ["127.0.0.1", "127.255.255.254", "0.0.0.0", "224.0.0.1", "239.255.255.250", "169.254.1.1"]) {
      expect(isQuarantinable(ip), ip).toBe(false)
    }
  })

  it("IPv6 y texto que no es IP se rechazan", () => {
    for (const ip of ["::1", "2001:db8::1", "fe80::1", "fc00::1", "nope", "", "999.1.1.1"]) {
      expect(isQuarantinable(ip), ip).toBe(false)
    }
  })

  it("los bordes de los rangos protegidos", () => {
    expect(isQuarantinable("223.255.255.255")).toBe(true)
    expect(isQuarantinable("169.253.255.255")).toBe(true)
    expect(isQuarantinable("169.255.0.0")).toBe(true)
    expect(isQuarantinable("0.0.0.1")).toBe(true)
  })
})

describe("isPrivateIp", () => {
  it("usa las redes internas del backend: RFC1918 y ULA", () => {
    for (const ip of ["10.1.2.3", "172.31.255.1", "192.168.3.41", "fc00::1", "fd12:3456::1"]) expect(isPrivateIp(ip), ip).toBe(true)
    for (const ip of ["8.8.8.8", "172.32.0.1", "127.0.0.1", "169.254.1.1", "2001:db8::1"]) expect(isPrivateIp(ip), ip).toBe(false)
  })
})

describe("isValidIp", () => {
  it("acepta IP completas, IPv4 e IPv6, con espacios alrededor", () => {
    for (const ip of ["203.0.113.45", "0.0.0.0", "255.255.255.255", "::1", "2001:db8::1", " 192.168.1.1 "]) {
      expect(isValidIp(ip), ip).toBe(true)
    }
  })

  it("rechaza texto a medio escribir y todo lo que el backend rechazaría", () => {
    for (const ip of ["", "192", "192.168", "192.168.1", "203.0.113.999", "1.2.3.4.5", "abc", "192.168.1.0/24", "01.2.3.4", "2001:db8:::1"]) {
      expect(isValidIp(ip), ip).toBe(false)
    }
  })
})
