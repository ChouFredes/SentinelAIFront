"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertFlags } from "@/components/alert-flags"
import { AlertStateBadge } from "@/components/alert-state-badge"
import { Countdown, useNow } from "@/components/countdown"
import { PageHeader } from "@/components/page-header"
import { PendingFeature } from "@/components/pending-feature"
import { QueryState } from "@/components/query-state"
import { RevertQuarantineButton } from "@/components/revert-quarantine-button"
import { ScoreBar } from "@/components/score-bar"
import { SeverityBadge } from "@/components/severity-badge"
import { useSite } from "@/components/site-provider"
import { ApiError } from "@/lib/api/client"
import { useAlert, useMitigationEvents, useQuarantines, useSiteConfig, useSiteSensors } from "@/lib/api/queries"
import type { AlertView, MitigationEvent } from "@/lib/api/schemas"
import {
  QUARANTINE_SECONDS,
  TAU,
  alertReason,
  deriveAlertState,
  findActiveQuarantine,
  findCoveringApply,
  findOwnApply,
  mitigationActor,
  reasonLabel,
} from "@/lib/domain"
import { formatDateTime, formatMse, formatTau, formatTime, parseIso } from "@/lib/format"

interface HistoryRow {
  key: string
  at: string
  event: string
  actor: string
  reason: string
}

function buildHistory(
  alert: AlertView,
  events: MitigationEvent[],
  siteName: (siteId: number) => string,
): HistoryRow[] {
  const rows: HistoryRow[] = [
    {
      key: "alert",
      at: alert.occurred_at,
      event: `Alerta registrada (${alert.severity === "critical" ? "crítica" : alert.severity === "high" ? "alta" : "advertencia"})`,
      actor: "Motor",
      reason: alertReason(alert),
    },
  ]
  const apply = findOwnApply(alert, events)
  if (!apply) {
    const prior = alert.mitigation_applied ? findCoveringApply(alert, events) : undefined
    if (prior) {
      // Repetición dentro de una cuarentena: el backend no aplica una regla nueva.
      rows.push({
        key: "prior",
        at: alert.occurred_at,
        event:
          prior.site_id === alert.site_id
            ? `Sin APPLY nuevo: la IP ya estaba en cuarentena (APPLY #${prior.id})`
            : `Sin APPLY nuevo: la IP ya estaba en cuarentena por ${siteName(prior.site_id)} (APPLY #${prior.id})`,
        actor: "Motor",
        reason:
          prior.site_id === alert.site_id
            ? "la regla de iptables ya existía"
            : "la regla de iptables es global y ya existía",
      })
      for (const e of events
        .filter((x) => x.original_event_id === prior.id)
        .sort((x, y) => parseIso(x.occurred_at).getTime() - parseIso(y.occurred_at).getTime())) {
        rows.push({
          key: `e${e.id}`,
          at: e.occurred_at,
          event: `${e.event_type} (referencia al APPLY #${prior.id})`,
          actor: mitigationActor(e),
          reason: reasonLabel(e.reason),
        })
      }
      return rows
    }
    if (alert.anomaly && alert.informative_only_mode) {
      rows.push({ key: "none", at: alert.occurred_at, event: "Sin acción de red", actor: "Motor", reason: "modo informativo" })
    } else if (alert.anomaly && alert.link_degraded) {
      rows.push({ key: "none", at: alert.occurred_at, event: "Sin acción de red", actor: "Motor", reason: "enlace degradado: respuesta suspendida" })
    }
    return rows
  }
  rows.push({
    key: `e${apply.id}`,
    at: apply.occurred_at,
    event: `APPLY: regla aplicada (${QUARANTINE_SECONDS} s)`,
    actor: mitigationActor(apply),
    reason: "anomalía, respuesta activa",
  })
  for (const e of events
    .filter((x) => x.original_event_id === apply.id)
    .sort((a, b) => parseIso(a.occurred_at).getTime() - parseIso(b.occurred_at).getTime())) {
    rows.push({
      key: `e${e.id}`,
      at: e.occurred_at,
      event: `${e.event_type} (referencia al APPLY #${apply.id})`,
      actor: mitigationActor(e),
      reason: reasonLabel(e.reason),
    })
  }
  return rows
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-sm font-medium tabular-nums">{children}</span>
    </div>
  )
}

export function AlertDetail({ alertId }: { alertId: number }) {
  const alertQuery = useAlert(alertId)
  const alert = alertQuery.data
  const { sites } = useSite()
  const now = useNow(1000)

  const config = useSiteConfig(alert?.site_id)
  const sensors = useSiteSensors(alert?.site_id)
  const quarantines = useQuarantines(alert?.site_id)
  // Por IP y sin filtro de sitio: la cuarentena que bloquea esta alerta puede ser de otro sitio.
  const events = useMitigationEvents({ source_ip: alert?.source_ip, limit: 200 }, !!alert)

  if (alertQuery.isError && alertQuery.error instanceof ApiError && alertQuery.error.status === 404) {
    return (
      <div className="flex flex-col items-start gap-3">
        <PageHeader title={`Alerta #${alertId}`} description="No encontramos esa alerta. Puede ser muy antigua o el enlace es incorrecto." />
        <Button variant="outline" render={<Link href="/alertas" />}>
          <ArrowLeft data-icon="inline-start" />
          Volver a Alertas
        </Button>
      </div>
    )
  }

  const siteNameOf = (id: number) => sites.find((s) => s.id === id)?.name ?? `Sitio ${id}`
  const siteName = alert ? siteNameOf(alert.site_id) : ""
  const sensorName = alert ? (sensors.data?.find((s) => s.sensor_id === alert.sensor_id)?.name ?? `sensor ${alert.sensor_id}`) : ""
  const threshold = config.data?.custom_mse_threshold ?? TAU
  const quarantine = alert ? findActiveQuarantine(alert, quarantines.data ?? [], now) : undefined
  const state = alert ? deriveAlertState(alert, quarantines.data ?? [], events.data ?? []) : undefined

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/alertas">Alertas</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>#{alertId}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <QueryState
        query={alertQuery}
        skeleton={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-16 w-80" />
            <Skeleton className="h-56 w-full" />
          </div>
        }
      >
        {alert && state && (
          <>
            <PageHeader
              title={`Alerta #${alert.id}`}
              badges={<SeverityBadge severity={alert.severity} />}
              description={`${siteName} · ${sensorName} · ${formatDateTime(alert.occurred_at)}`}
              actions={<AlertFlags alert={alert} />}
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Flujo detectado</CardTitle>
                  <CardDescription>Datos de la alerta tal como los registró el motor</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 2xl:grid-cols-5">
                    <Field label="Origen">{alert.source_ip}</Field>
                    <Field label="Destino">
                      {alert.destination_ip}:{alert.destination_port}
                    </Field>
                    <Field label="Score (MSE)">{formatMse(alert.mse_score)}</Field>
                    <Field label="Umbral del sitio">{formatTau(threshold)}</Field>
                    <Field label="Severidad">
                      <SeverityBadge severity={alert.severity} />
                    </Field>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <ScoreBar score={alert.mse_score} threshold={threshold} />
                    <p className="text-xs text-muted-foreground">
                      El MSE es {(alert.mse_score / threshold).toLocaleString("es-AR", { maximumFractionDigits: 1 })} veces el
                      umbral{config.data?.custom_mse_threshold != null ? " propio del sitio" : " global (τ)"}. Las marcas indican el umbral del sitio y el umbral crítico (3 × el mayor entre τ global y el umbral del sitio).
                    </p>
                  </div>
                  <PendingFeature
                    title="Características con mayor error de reconstrucción"
                    note="El backend todavía no informa el error por característica."
                  >
                    <div className="h-28 rounded-md border border-dashed border-border bg-[repeating-linear-gradient(135deg,transparent,transparent_8px,var(--muted)_8px,var(--muted)_16px)]" />
                  </PendingFeature>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardDescription>Acción vigente</CardDescription>
                  <CardTitle className="text-lg">
                    {quarantine ? (
                      <>
                        Cuarentena {QUARANTINE_SECONDS} s · vence {formatTime(quarantine.expires_at)}
                      </>
                    ) : (
                      "Sin acción vigente"
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    Estado: <AlertStateBadge state={state} />
                  </div>
                  {state === "blocked_other_site" && (
                    <p className="text-sm text-muted-foreground">
                      Esta alerta no generó una regla nueva: la IP ya estaba en cuarentena por una alerta de otro sitio
                      (la regla de iptables es global).
                    </p>
                  )}
                  {state === "blocked_prior_quarantine" && (
                    <p className="text-sm text-muted-foreground">
                      Esta alerta no generó una regla nueva: la IP ya estaba en cuarentena por una alerta anterior.
                    </p>
                  )}
                  {quarantine && (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm">
                        Restan <Countdown expiresAt={quarantine.expires_at} className="font-mono font-medium tabular-nums" />
                      </p>
                      <div>
                        <RevertQuarantineButton
                          sourceIp={alert.source_ip}
                          siteId={alert.site_id}
                          siteName={siteName}
                          label="Revertir ahora"
                          size="default"
                        />
                      </div>
                    </div>
                  )}
                  <PendingFeature note="Marcar falso positivo todavía no existe en el backend.">
                    <Button variant="outline" disabled>
                      Marcar falso positivo
                    </Button>
                  </PendingFeature>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Historial de la acción</CardTitle>
                <CardDescription>Registro de solo inserción: cada reversión referencia a su APPLY</CardDescription>
              </CardHeader>
              <CardContent>
                <QueryState query={events}>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Hora</TableHead>
                          <TableHead>Evento</TableHead>
                          <TableHead>Actor</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {buildHistory(alert, events.data ?? [], siteNameOf).map((r) => (
                          <TableRow key={r.key}>
                            <TableCell className="font-mono text-xs whitespace-nowrap">{formatTime(r.at)}</TableCell>
                            <TableCell>{r.event}</TableCell>
                            <TableCell>{r.actor}</TableCell>
                            <TableCell className="text-muted-foreground">{r.reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </QueryState>
              </CardContent>
            </Card>
          </>
        )}
      </QueryState>
    </div>
  )
}
