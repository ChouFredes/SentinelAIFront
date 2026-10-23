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
