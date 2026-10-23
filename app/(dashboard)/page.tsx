"use client"

import * as React from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ActiveQuarantines } from "@/components/active-quarantines"
import { MetricCard } from "@/components/metric-card"
import { PageHeader } from "@/components/page-header"
import { QueryState } from "@/components/query-state"
import { RecentAlertsList } from "@/components/recent-alerts-list"
import { SensorsCard } from "@/components/sensors-card"
import { useSite } from "@/components/site-provider"
import { TopOrigins } from "@/components/top-origins"
import { AnomalyAreaChart } from "@/components/charts/anomaly-area-chart"
import { SeverityBarChart } from "@/components/charts/severity-bar-chart"
import { useAlerts, useHealth, useQuarantines, useSensorsOfSites, useSummaries } from "@/lib/api/queries"
import { TAU, sensorStatus } from "@/lib/domain"
import { formatInt, formatTau } from "@/lib/format"
import { mergeSummaries } from "@/lib/summary-utils"

const HOURS = 24

export default function ResumenPage() {
  const { selected, sites, current } = useSite()
  const siteIds = React.useMemo(
    () => (selected === "all" ? sites.map((s) => s.id) : [selected]),
    [selected, sites],
  )
  const siteId = selected === "all" ? undefined : selected
  const siteName = React.useCallback((id: number) => sites.find((s) => s.id === id)?.name, [sites])

  const summaries = useSummaries(siteIds, HOURS)
  const summary = mergeSummaries(summaries.flatMap((q) => (q.data ? [q.data] : [])))
  const summaryQuery = {
    isLoading: sites.length === 0 || summaries.some((q) => q.isLoading),
    isError: summaries.some((q) => q.isError),
    error: summaries.find((q) => q.error)?.error,
    refetch: () => summaries.forEach((q) => void q.refetch()),
  }
  const sensorQueries = useSensorsOfSites(siteIds)
  const sensors = sensorQueries.flatMap((q) => q.data ?? [])
  const quarantines = useQuarantines(siteId)
  const critical = useAlerts({ site_id: siteId, severity: "critical", limit: 5 })
  const health = useHealth()

  const online = sensors.filter((s) => sensorStatus(s) !== "offline").length
  const threshold = current?.config.custom_mse_threshold ?? TAU

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={current ? current.name : "Todos los sitios"}
        description={
          <>
            Detección de anomalías con autoencoder no supervisado. Umbral de reconstrucción{" "}
            <span className="font-mono text-foreground">τ = {formatTau(threshold)}</span>
            {current?.config.custom_mse_threshold != null && " (propio del sitio)"}.
          </>
        }
        badges={
          current?.config.informative_only_mode ? (
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              Modo informativo
            </Badge>
          ) : undefined
        }
      />

      <section aria-label="Indicadores principales" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={`Alertas (${HOURS} h)`}
          value={formatInt(summary?.total_alerts ?? 0)}
          hint={summary ? `${formatInt(summary.flows_analyzed)} flujos analizados en total` : undefined}
          loading={!summary && summaryQuery.isLoading}
        />
        <MetricCard
          label="Críticas"
          value={formatInt(summary?.by_severity.critical ?? 0)}
          hint={`${formatInt(summary?.by_severity.high ?? 0)} altas · ${formatInt(summary?.by_severity.warning ?? 0)} advertencias`}
          loading={!summary && summaryQuery.isLoading}
        />
        <MetricCard
          label="Cuarentenas activas"
          value={formatInt(quarantines.data?.length ?? 0)}
          hint="Se levantan solas al vencer"
          loading={quarantines.isLoading}
        />
        <MetricCard
          label="Sensores en línea"
          value={`${online} de ${sensors.length}`}
          loading={sensorQueries.some((q) => q.isLoading)}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Alertas por hora</CardTitle>
            <CardDescription>Flujos anómalos detectados — últimas {HOURS} h (hora de Buenos Aires)</CardDescription>
          </CardHeader>
          <CardContent>
            <QueryState query={summaryQuery} isEmpty={summary === undefined && !summaryQuery.isLoading}>
              {summary && <AnomalyAreaChart data={summary.by_hour} />}
            </QueryState>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribución por severidad</CardTitle>
            <CardDescription>Alertas de las últimas {HOURS} h</CardDescription>
          </CardHeader>
          <CardContent>
            <QueryState query={summaryQuery}>{summary && <SeverityBarChart counts={summary.by_severity} />}</QueryState>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActiveQuarantines siteId={siteId} />
        </div>
        <TopOrigins sources={summary?.top_sources ?? []} hours={HOURS} />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <QueryState query={critical}>
            <RecentAlertsList alerts={critical.data?.items ?? []} siteName={selected === "all" ? siteName : undefined} />
          </QueryState>
        </div>
        <div className="flex flex-col gap-4">
          <SensorsCard sensors={sensors} siteName={selected === "all" ? siteName : undefined} />
          <Card>
            <CardHeader>
              <CardTitle>Backend</CardTitle>
              <CardDescription>Estado de /health</CardDescription>
            </CardHeader>
            <CardContent>
              <QueryState query={health}>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {[
                    ["Modelo de ML", health.data?.ml_ready],
                    ["Base de datos (al iniciar)", health.data?.database_ready_at_startup],
                    ["Registro de eventos", health.data?.logging_ready],
                  ].map(([label, ok]) => (
                    <li key={label as string} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={ok ? "text-success-foreground" : "text-critical-foreground"}>
                        {ok ? "Listo" : "No disponible"}
                      </span>
                    </li>
                  ))}
                </ul>
              </QueryState>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
