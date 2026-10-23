"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, Download, Eye, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AlertFlags } from "@/components/alert-flags"
import { AlertStateBadge } from "@/components/alert-state-badge"
import { Countdown, useNow } from "@/components/countdown"
import { PageHeader } from "@/components/page-header"
import { QueryState } from "@/components/query-state"
import { RevertQuarantineButton } from "@/components/revert-quarantine-button"
import { ScoreBar } from "@/components/score-bar"
import { SeverityBadge } from "@/components/severity-badge"
import { SimpleSelect } from "@/components/simple-select"
import { useSite } from "@/components/site-provider"
import { useAlerts, useMitigationEvents, useQuarantines } from "@/lib/api/queries"
import { severitySchema, type Severity } from "@/lib/api/schemas"
import { downloadFile, toCsv } from "@/lib/csv"
import {
  ALERT_STATE_LABEL,
  SEVERITY_LABEL,
  TAU,
  deriveAlertState,
  findActiveQuarantine,
  type AlertState,
} from "@/lib/domain"
import { formatDateTime, formatMse, formatShortDateTime } from "@/lib/format"

const PAGE_SIZE = 50

const PERIODS = [
  { value: "24h", label: "Últimas 24 h", hours: 24 },
  { value: "7d", label: "Últimos 7 días", hours: 24 * 7 },
  { value: "30d", label: "Últimos 30 días", hours: 24 * 30 },
  { value: "all", label: "Todo el historial", hours: 0 },
]

type StateFilter =
  | "all"
  | "quarantine_active"
  | "blocked_prior_quarantine"
  | "blocked_other_site"
  | "reverted"
  | "informative"
  | "suspended_link"
  | "detected"

const STATE_FILTERS: { value: StateFilter; label: string }[] = [
  { value: "all", label: "Estado: todos" },
  { value: "quarantine_active", label: ALERT_STATE_LABEL.quarantine_active },
  { value: "blocked_prior_quarantine", label: ALERT_STATE_LABEL.blocked_prior_quarantine },
  { value: "blocked_other_site", label: ALERT_STATE_LABEL.blocked_other_site },
  { value: "reverted", label: "Revertida" },
  { value: "informative", label: ALERT_STATE_LABEL.informative },
  { value: "suspended_link", label: ALERT_STATE_LABEL.suspended_link },
  { value: "detected", label: ALERT_STATE_LABEL.detected },
]

function matchesState(filter: StateFilter, state: AlertState): boolean {
  if (filter === "all") return true
  if (filter === "reverted") return state === "reverted_manual" || state === "reverted_timer"
  return filter === state
}

export function AlertsView() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const { selected, setSelected, sites } = useSite()
  const now = useNow(1000)

  const severityParam = severitySchema.safeParse(params.get("severidad"))
  const severity: Severity | undefined = severityParam.success ? severityParam.data : undefined
  const period = PERIODS.find((p) => p.value === params.get("periodo")) ?? PERIODS[1]
  const stateFilter = (STATE_FILTERS.find((f) => f.value === params.get("estado"))?.value ?? "all") as StateFilter
  const ip = params.get("ip") ?? ""
  const siteId = selected === "all" ? undefined : selected

  const setParam = React.useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString())
      if (value === null || value === "" || value === "all") next.delete(key)
      else next.set(key, value)
      next.delete("pagina")
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false })
    },
    [params, pathname, router],
  )

  // La IP se escribe en un input local y recién se manda a la URL cuando el usuario deja de tipear.
  const [ipDraft, setIpDraft] = React.useState(ip)
  React.useEffect(() => {
    const id = setTimeout(() => {
      if (ipDraft.trim() !== ip) setParam("ip", ipDraft.trim())
    }, 400)
    return () => clearTimeout(id)
  }, [ipDraft, ip, setParam])

  // Paginación por before_id: guardamos la pila de cursores de las páginas ya recorridas.
  const [cursors, setCursors] = React.useState<(number | undefined)[]>([undefined])
  const filterKey = `${siteId}|${severity}|${ip}|${period.value}`
  const [lastKey, setLastKey] = React.useState(filterKey)
  if (lastKey !== filterKey) {
    setLastKey(filterKey)
    setCursors([undefined])
  }
  const pageIndex = cursors.length - 1

  // `since` se redondea al minuto para no cambiar la query key en cada render.
  const minute = Math.floor(now / 60_000)
  const since = period.hours ? new Date(minute * 60_000 - period.hours * 3_600_000).toISOString() : undefined

  const alerts = useAlerts({
    site_id: siteId,
    severity,
    source_ip: ip || undefined,
    since,
    before_id: cursors[pageIndex],
    limit: PAGE_SIZE,
  })
  const quarantines = useQuarantines(siteId)
  // Sin filtro de sitio: la regla de iptables es global y una alerta puede estar bloqueada por la cuarentena de otro sitio.
  const events = useMitigationEvents({ limit: 1000 })

  const siteName = React.useCallback((id: number) => sites.find((s) => s.id === id)?.name ?? `Sitio ${id}`, [sites])
  const thresholdOf = React.useCallback(
    (id: number) => sites.find((s) => s.id === id)?.config.custom_mse_threshold ?? TAU,
    [sites],
  )

  const rows = React.useMemo(() => {
    const q = quarantines.data ?? []
    const e = events.data ?? []
    return (alerts.data?.items ?? [])
      .map((alert) => ({ alert, state: deriveAlertState(alert, q, e) }))
      .filter((r) => matchesState(stateFilter, r.state))
    // `now` fuerza el recálculo cuando una cuarentena vence entre refrescos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts.data, quarantines.data, events.data, stateFilter, now])

  function exportCsv() {
    const csv = toCsv(
      ["id", "sitio", "sensor_id", "origen", "destino", "puerto", "mse", "severidad", "estado", "dispositivo_no_reconocido", "enlace_degradado", "modo_informativo", "mitigada", "fecha"],
      rows.map(({ alert: a, state }) => [
        a.id,
        siteName(a.site_id),
        a.sensor_id,
        a.source_ip,
        a.destination_ip,
        a.destination_port,
        a.mse_score,
        SEVERITY_LABEL[a.severity],
        ALERT_STATE_LABEL[state],
        a.unrecognized_device,
        a.link_degraded,
        a.informative_only_mode,
        a.mitigation_applied,
        formatDateTime(a.occurred_at),
      ]),
    )
    downloadFile(`alertas-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv")
  }

  // El backend no informa el total: se muestra solo el tamaño de la página.
  const pageSize = alerts.data?.items.length ?? 0
  const hasNext = alerts.data?.next_before_id != null

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Alertas"
        description={
          selected === "all"
            ? "Histórico de alertas de todos los sitios."
            : `Histórico de alertas de ${siteName(selected)}.`
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SimpleSelect
          ariaLabel="Filtrar por sitio"
          className="w-44"
          value={String(selected)}
          onValueChange={(v) => setSelected(v === "all" ? "all" : Number(v))}
          options={[
            { value: "all", label: "Sitio: todos" },
            ...sites.map((s) => ({ value: String(s.id), label: s.name })),
          ]}
        />
        <SimpleSelect
          ariaLabel="Filtrar por severidad"
          className="w-40"
          value={severity ?? "all"}
          onValueChange={(v) => setParam("severidad", v)}
          options={[
            { value: "all", label: "Severidad: todas" },
            { value: "critical", label: SEVERITY_LABEL.critical },
            { value: "high", label: SEVERITY_LABEL.high },
            { value: "warning", label: SEVERITY_LABEL.warning },
          ]}
        />
        <SimpleSelect
          ariaLabel="Filtrar por estado"
          className="w-64"
          value={stateFilter}
          onValueChange={(v) => setParam("estado", v)}
          options={STATE_FILTERS}
        />
        <SimpleSelect
          ariaLabel="Período"
          className="w-44"
          value={period.value}
          onValueChange={(v) => setParam("periodo", v)}
          options={PERIODS}
        />
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={ipDraft}
            onChange={(e) => setIpDraft(e.target.value)}
            placeholder="Buscar IP de origen…"
            aria-label="Buscar por IP de origen"
            className="h-7 pl-8 font-mono"
          />
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
          <Download data-icon="inline-start" />
          Exportar CSV
        </Button>
      </div>

      <QueryState query={alerts} isEmpty={alerts.data?.items.length === 0} emptyMessage="No hay alertas con esos filtros.">
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severidad</TableHead>
                {selected === "all" && <TableHead>Sitio</TableHead>}
                <TableHead>Origen → destino</TableHead>
                <TableHead className="min-w-28">Score (MSE)</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Indicadores</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={selected === "all" ? 8 : 7} className="py-8 text-center text-muted-foreground">
                    Ninguna alerta de esta página coincide con el estado elegido.
                  </TableCell>
                </TableRow>
              )}
              {rows.map(({ alert, state }) => {
                const q = findActiveQuarantine(alert, quarantines.data ?? [], now)
                return (
                  <TableRow key={alert.id}>
                    <TableCell>
                      <SeverityBadge severity={alert.severity} />
                    </TableCell>
                    {selected === "all" && <TableCell>{siteName(alert.site_id)}</TableCell>}
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      <Link href={`/alertas/${alert.id}`} className="hover:underline">
                        {alert.source_ip}
                      </Link>
                      <span className="text-muted-foreground">
                        {" → "}
                        {alert.destination_ip}:{alert.destination_port}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-xs tabular-nums">{formatMse(alert.mse_score)}</span>
                        <ScoreBar score={alert.mse_score} threshold={thresholdOf(alert.site_id)} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <AlertStateBadge state={state}>
                        {q && (
                          <>
                            {" · "}
                            <Countdown expiresAt={q.expires_at} className="font-mono tabular-nums" />
                          </>
                        )}
                      </AlertStateBadge>
                    </TableCell>
                    <TableCell>
                      <AlertFlags alert={alert} />
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                      {formatShortDateTime(alert.occurred_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        {q && (
                          <RevertQuarantineButton
                            sourceIp={alert.source_ip}
                            siteId={alert.site_id}
                            siteName={siteName(alert.site_id)}
                          />
                        )}
                        <Button
                          variant="outline"
                          size="icon-sm"
                          title="Ver detalle"
                          render={<Link href={`/alertas/${alert.id}`} aria-label={`Ver alerta ${alert.id}`} />}
                        >
                          <Eye />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            Página {pageIndex + 1} · {pageSize} {pageSize === 1 ? "alerta" : "alertas"}
            {stateFilter !== "all" && ` · ${rows.length} coinciden con el estado`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pageIndex === 0}
              onClick={() => setCursors((c) => c.slice(0, -1))}
            >
              <ChevronLeft data-icon="inline-start" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext}
              onClick={() => setCursors((c) => [...c, alerts.data?.next_before_id ?? undefined])}
            >
              Siguiente
              <ChevronRight data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </QueryState>
    </div>
  )
}
