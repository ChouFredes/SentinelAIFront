// Fechas ISO 8601 del backend. FastAPI serializa los datetime sin zona (naive)
// como UTC; sin este paso `new Date("2026-10-19T17:10:32")` los tomaría como
// hora local del navegador o del servidor.

const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i

/** Un ISO sin offset se interpreta como UTC (se le agrega "Z"); uno con offset queda igual. */
export function toUtcIso(iso: string): string {
  return HAS_OFFSET.test(iso) ? iso : `${iso}Z`
}
