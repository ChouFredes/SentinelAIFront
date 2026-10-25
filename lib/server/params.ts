import { isValidIp } from "@/lib/cidr"
import { BackendError } from "@/lib/server/errors"

export function intParam(sp: URLSearchParams, name: string): number | undefined {
  const raw = sp.get(name)
  if (raw === null || raw === "") return undefined
  if (!/^-?\d+$/.test(raw)) throw new BackendError(422, `${name} debe ser un entero`)
  return Number(raw)
}

export function pathInt(raw: string, name: string): number {
  if (!/^\d+$/.test(raw)) throw new BackendError(422, `${name} debe ser un entero`)
  return Number(raw)
}

/** `source_ip` opcional: tiene que ser una IP completa (el backend la valida y responde 422 si no). */
export function ipParam(sp: URLSearchParams, name = "source_ip"): string | undefined {
  const raw = sp.get(name)?.trim()
  if (!raw) return undefined
  if (!isValidIp(raw)) throw new BackendError(422, `${name} no es una IP válida`)
  return raw
}
