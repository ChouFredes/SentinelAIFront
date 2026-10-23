import { MAX_KNOWN_DEVICES } from "@/lib/api/schemas"

export { MAX_KNOWN_DEVICES }

function parseIPv4(s: string): number[] | null {
  const parts = s.split(".")
  if (parts.length !== 4) return null
  const out: number[] = []
  for (const p of parts) {
    if (!/^(0|[1-9]\d{0,2})$/.test(p)) return null
    const n = Number(p)
    if (n > 255) return null
    out.push(n)
  }
  return out
}

/** IPv6 → 16 bytes, o null si es inválida. Soporta "::" y sufijo IPv4. */
function parseIPv6(input: string): number[] | null {
  let s = input
  if (!s.includes(":") || /[^0-9a-fA-F:.]/.test(s)) return null
  let tail: number[] = []
  const lastColon = s.lastIndexOf(":")
  if (s.slice(lastColon + 1).includes(".")) {
    const v4 = parseIPv4(s.slice(lastColon + 1))
    if (!v4) return null
    tail = v4
    s = `${s.slice(0, lastColon + 1)}0:0`
  }
  const halves = s.split("::")
  if (halves.length > 2) return null
  const toGroups = (h: string) => (h === "" ? [] : h.split(":"))
  const head = toGroups(halves[0])
  const rest = halves.length === 2 ? toGroups(halves[1]) : []
  const total = head.length + rest.length
  if (halves.length === 1 ? total !== 8 : total > 7) return null
  const groups = [...head, ...Array(8 - total).fill("0"), ...rest]
  const bytes: number[] = []
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null
    const n = parseInt(g, 16)
    bytes.push(n >> 8, n & 0xff)
  }
  if (tail.length) bytes.splice(12, 4, ...tail)
  return bytes
}

function parseIp(s: string): { bytes: number[]; version: 4 | 6 } | null {
  const v4 = parseIPv4(s)
  if (v4) return { bytes: v4, version: 4 }
  const v6 = parseIPv6(s)
  if (v6) return { bytes: v6, version: 6 }
  return null
}

export interface ParsedCidr {
  bytes: number[]
  prefix: number
  version: 4 | 6
}

export function parseCidr(input: string): ParsedCidr | null {
  const [addr, len, ...extra] = input.trim().split("/")
  if (extra.length || len === undefined || !/^\d{1,3}$/.test(len)) return null
  const ip = parseIp(addr)
  if (!ip) return null
  const prefix = Number(len)
  if (prefix > (ip.version === 4 ? 32 : 128)) return null
  return { ...ip, prefix }
}

export function isValidCidr(input: string): boolean {
  return parseCidr(input) !== null
}

/** Normaliza para comparar: sin espacios y con la dirección de red enmascarada. */
export function normalizeCidr(input: string): string | null {
  const c = parseCidr(input)
  if (!c) return null
  const masked = maskBytes(c.bytes, c.prefix)
  return `${formatBytesAsIp(masked, c.version)}/${c.prefix}`
}

function maskBytes(bytes: number[], prefix: number): number[] {
  return bytes.map((b, i) => {
    const bits = Math.max(0, Math.min(8, prefix - i * 8))
    return b & (0xff << (8 - bits)) & 0xff
  })
}

function formatBytesAsIp(bytes: number[], version: 4 | 6): string {
  if (version === 4) return bytes.join(".")
  const groups: string[] = []
  for (let i = 0; i < 16; i += 2) groups.push(((bytes[i] << 8) | bytes[i + 1]).toString(16))
  return groups.join(":")
}

export function ipInCidr(ip: string, cidr: string): boolean {
  const a = parseIp(ip)
  const c = parseCidr(cidr)
  if (!a || !c || a.version !== c.version) return false
  const m = maskBytes(a.bytes, c.prefix)
  const n = maskBytes(c.bytes, c.prefix)
  return m.every((b, i) => b === n[i])
}

export function ipInCidrs(ip: string, cidrs: string[]): boolean {
  return cidrs.some((c) => ipInCidr(ip, c))
}

/** "192.168.3.41" → "192.168.3.41/32"; IPv6 → /128. */
export function hostCidr(ip: string): string | null {
  const parsed = parseIp(ip)
  if (!parsed) return null
  return `${ip}/${parsed.version === 4 ? 32 : 128}`
}

export type CidrError = "invalid" | "duplicate" | "limit"

export function validateNewCidr(input: string, existing: string[]): CidrError | null {
  const norm = normalizeCidr(input)
  if (!norm) return "invalid"
  if (existing.length >= MAX_KNOWN_DEVICES) return "limit"
  if (existing.some((e) => normalizeCidr(e) === norm)) return "duplicate"
  return null
}

export const CIDR_ERROR_MESSAGE: Record<CidrError, string> = {
  invalid: "No es un CIDR válido (ej. 192.168.2.0/27)",
  duplicate: "Ese rango ya está en el inventario",
  limit: `El inventario admite hasta ${MAX_KNOWN_DEVICES} rangos`,
}

const PRIVATE_RANGES = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8", "fc00::/7"]

export function isPrivateIp(ip: string): boolean {
  return ipInCidrs(ip, PRIVATE_RANGES)
}
