"use client"

import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { apiGet, apiSend } from "@/lib/api/client"
import {
  adminQuarantineViewSchema,
  alertViewSchema,
  alertsPageSchema,
  flowSampleSchema,
  healthResponseSchema,
  manualReversionResponseSchema,
  mitigationEventSchema,
  sensorTelemetryViewSchema,
  siteConfigViewSchema,
  siteSensorViewSchema,
  siteSummarySchema,
  siteViewSchema,
  type Severity,
  type SiteConfigUpdate,
} from "@/lib/api/schemas"

const POLL_MS = 15_000

export interface AlertsQuery {
  site_id?: number
  severity?: Severity
  source_ip?: string
  since?: string
  until?: string
  unrecognized_device?: boolean
  before_id?: number
  limit?: number
}

export const keys = {
  health: ["health"] as const,
  sites: ["sites"] as const,
  alerts: (q: AlertsQuery) => ["alerts", q] as const,
  alert: (id: number) => ["alert", id] as const,
  config: (siteId: number) => ["site-config", siteId] as const,
  sensors: (siteId: number) => ["site-sensors", siteId] as const,
  summary: (siteId: number, hours: number) => ["summary", siteId, hours] as const,
  quarantines: (siteId?: number) => ["quarantines", siteId ?? "all"] as const,
  events: (q: { site_id?: number; source_ip?: string; limit?: number }) => ["mitigation-events", q] as const,
  flows: (sensorId: number, limit: number) => ["flows", sensorId, limit] as const,
  telemetry: (sensorId: number) => ["telemetry", sensorId] as const,
}

export const useHealth = () =>
  useQuery({
    queryKey: keys.health,
    queryFn: () => apiGet("/health", healthResponseSchema),
    refetchInterval: 30_000,
    retry: false,
  })

export const useSites = () =>
  useQuery({ queryKey: keys.sites, queryFn: () => apiGet("/sites", z.array(siteViewSchema)) })

export const useAlerts = (q: AlertsQuery, enabled = true) =>
  useQuery({
    queryKey: keys.alerts(q),
    queryFn: () => apiGet("/alerts", alertsPageSchema, { ...q }),
    placeholderData: keepPreviousData,
    refetchInterval: POLL_MS,
    enabled,
  })

export const useAlert = (id: number) =>
  useQuery({
    queryKey: keys.alert(id),
    queryFn: () => apiGet(`/alerts/${id}`, alertViewSchema),
    retry: (count, err) => (err as { status?: number }).status !== 404 && count < 2,
  })

export const useSiteConfig = (siteId: number | undefined) =>
  useQuery({
    queryKey: keys.config(siteId ?? -1),
    queryFn: () => apiGet(`/sites/${siteId}/config`, siteConfigViewSchema),
    enabled: siteId !== undefined,
  })

export const useSiteSensors = (siteId: number | undefined) =>
  useQuery({
    queryKey: keys.sensors(siteId ?? -1),
    queryFn: () => apiGet(`/sites/${siteId}/sensors`, z.array(siteSensorViewSchema)),
    enabled: siteId !== undefined,
    refetchInterval: POLL_MS,
  })

export const useSummary = (siteId: number | undefined, hours = 24) =>
  useQuery({
    queryKey: keys.summary(siteId ?? -1, hours),
    queryFn: () => apiGet(`/sites/${siteId}/summary`, siteSummarySchema, { hours }),
    enabled: siteId !== undefined,
    refetchInterval: 60_000,
  })

/** Un resumen por sitio (para la vista "Todos los sitios"). */
export const useSummaries = (siteIds: number[], hours = 24) =>
  useQueries({
    queries: siteIds.map((id) => ({
      queryKey: keys.summary(id, hours),
      queryFn: () => apiGet(`/sites/${id}/summary`, siteSummarySchema, { hours }),
      refetchInterval: 60_000,
    })),
  })

export const useSensorsOfSites = (siteIds: number[]) =>
  useQueries({
    queries: siteIds.map((id) => ({
      queryKey: keys.sensors(id),
      queryFn: () => apiGet(`/sites/${id}/sensors`, z.array(siteSensorViewSchema)),
      refetchInterval: POLL_MS,
    })),
  })

export const useQuarantines = (siteId?: number) =>
  useQuery({
    queryKey: keys.quarantines(siteId),
    queryFn: () => apiGet("/quarantines", z.array(adminQuarantineViewSchema), { site_id: siteId }),
    refetchInterval: POLL_MS,
  })

export const useMitigationEvents = (q: { site_id?: number; source_ip?: string; limit?: number }, enabled = true) =>
  useQuery({
    queryKey: keys.events(q),
    queryFn: () => apiGet("/mitigation-events", z.array(mitigationEventSchema), q),
    refetchInterval: POLL_MS,
    enabled,
  })

export const useFlows = (sensorId: number | undefined, limit = 20) =>
  useQuery({
    queryKey: keys.flows(sensorId ?? -1, limit),
    queryFn: () => apiGet(`/sensors/${sensorId}/flows`, z.array(flowSampleSchema), { limit }),
    enabled: sensorId !== undefined,
  })

export const useTelemetry = (sensorId: number | undefined) =>
  useQuery({
    queryKey: keys.telemetry(sensorId ?? -1),
    queryFn: () => apiGet(`/sensors/${sensorId}/telemetry`, sensorTelemetryViewSchema),
    enabled: sensorId !== undefined,
  })

export function useRevertQuarantine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sourceIp, siteId }: { sourceIp: string; siteId: number }) =>
      apiSend(`/quarantines/${encodeURIComponent(sourceIp)}/revert`, "POST", manualReversionResponseSchema, {
        query: { site_id: siteId },
      }),
    // También en error: un 404/409 significa que el estado cambió y hay que refrescar.
    onSettled: () => {
      for (const key of ["quarantines", "alerts", "alert", "mitigation-events", "summary"]) {
        void qc.invalidateQueries({ queryKey: [key] })
      }
    },
  })
}

export function useUpdateSiteConfig(siteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (update: SiteConfigUpdate) =>
      apiSend(`/sites/${siteId}/config`, "PUT", siteConfigViewSchema, { body: update }),
    onSuccess: (config) => {
      qc.setQueryData(keys.config(siteId), config)
      for (const key of ["sites", "alerts"]) void qc.invalidateQueries({ queryKey: [key] })
    },
  })
}
