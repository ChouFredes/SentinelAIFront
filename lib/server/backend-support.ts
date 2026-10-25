import "server-only"
import { getEnv } from "@/lib/server/env"

/**
 * Qué endpoints existen hoy en el backend (rama 75). Los que están en `false` usan
 * mock siempre, aunque SENTINEL_USE_MOCKS=false, hasta que se implementen
 * (ver docs/backend-pendiente.md).
 */
export const BACKEND_SUPPORT = {
  health: true,
  alerts: true,
  alertDetail: true,
  siteConfig: true,
  telemetry: true,
  revert: true,
  sites: true,
  siteSensors: true,
  mitigationEvents: true,
  quarantines: true,
  flows: false,
} as const

export type Endpoint = keyof typeof BACKEND_SUPPORT

export function shouldMock(endpoint: Endpoint): boolean {
  return getEnv().useMocks || !BACKEND_SUPPORT[endpoint]
}
