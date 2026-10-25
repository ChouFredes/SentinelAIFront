"use client"

import * as React from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/page-header"
import { QueryState } from "@/components/query-state"
import { SimpleSelect } from "@/components/simple-select"
import { useSite } from "@/components/site-provider"
import { useMitigationEvents } from "@/lib/api/queries"
import type { MitigationEventType } from "@/lib/api/schemas"
import { mitigationActor, reasonLabel } from "@/lib/domain"
import { formatDateTime, formatDestination, formatMseOrDash } from "@/lib/format"
import { cn } from "@/lib/utils"

const PAGE = 100

const TYPE_STYLE: Record<MitigationEventType, string> = {
  APPLY: "border-critical/30 bg-critical/12 text-critical-foreground",
  REVERSION: "border-border bg-muted/50 text-muted-foreground",
  MANUAL_REVERSION: "border-primary/30 bg-primary/10 text-primary",
}

export default function AuditoriaPage() {
  const { selected, setSelected, sites } = useSite()
  const siteId = selected === "all" ? undefined : selected
  const [type, setType] = React.useState<"all" | MitigationEventType>("all")
  const [ip, setIp] = React.useState("")
  const [shown, setShown] = React.useState(PAGE)

  const events = useMitigationEvents({ site_id: siteId, source_ip: ip.trim() || undefined, limit: 1000 })
  const siteName = (id: number) => sites.find((s) => s.id === id)?.name ?? `Sitio ${id}`
  const filtered = (events.data ?? []).filter((e) => type === "all" || e.event_type === type)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Auditoría"
        description="Historial de mitigaciones. Es un registro de solo inserción: la base rechaza ediciones y borrados, y cada reversión referencia a su APPLY (RF-04)."
      />

      <div className="flex flex-wrap items-center gap-2">
        <SimpleSelect
          ariaLabel="Filtrar por sitio"
          className="w-44"
          value={String(selected)}
          onValueChange={(v) => {
            setSelected(v === "all" ? "all" : Number(v))
            setShown(PAGE)
          }}
          options={[{ value: "all", label: "Sitio: todos" }, ...sites.map((s) => ({ value: String(s.id), label: s.name }))]}
        />
        <SimpleSelect
          ariaLabel="Filtrar por tipo de evento"
          className="w-52"
          value={type}
          onValueChange={(v) => {
            setType(v as typeof type)
            setShown(PAGE)
          }}
          options={[
            { value: "all", label: "Evento: todos" },
            { value: "APPLY", label: "APPLY" },
            { value: "REVERSION", label: "REVERSION" },
            { value: "MANUAL_REVERSION", label: "MANUAL_REVERSION" },
          ]}
        />
        <Input
          value={ip}
          onChange={(e) => {
            setIp(e.target.value)
            setShown(PAGE)
          }}
          placeholder="Buscar IP de origen…"
          aria-label="Buscar por IP de origen"
          className="h-7 max-w-56 font-mono"
        />
      </div>

      <QueryState query={events} isEmpty={filtered.length === 0} emptyMessage="No hay eventos con esos filtros.">
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Evento</TableHead>
                {selected === "all" && <TableHead>Sitio</TableHead>}
                <TableHead>Origen → destino</TableHead>
                <TableHead>MSE</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, shown).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs whitespace-nowrap">{formatDateTime(e.occurred_at)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <Badge variant="outline" className={cn("font-mono text-[10px]", TYPE_STYLE[e.event_type])}>
                        {e.event_type}
                      </Badge>
                      <span className="font-mono text-[10px] whitespace-nowrap text-muted-foreground">
                        #{e.id}
                        {e.original_event_id !== null && ` → APPLY #${e.original_event_id}`}
                      </span>
                    </div>
                  </TableCell>
                  {selected === "all" && <TableCell>{siteName(e.site_id)}</TableCell>}
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    <Link
                      href={`/alertas?ip=${encodeURIComponent(e.source_ip)}&periodo=all`}
                      className="hover:underline"
                    >
                      {e.source_ip}
                    </Link>
                    <span className="text-muted-foreground">
                      {" → "}
                      {formatDestination(e.destination_ip, e.destination_port)}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">{formatMseOrDash(e.mse_score)}</TableCell>
                  <TableCell>{mitigationActor(e)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {reasonLabel(e.reason)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Mostrando {Math.min(shown, filtered.length)} de {filtered.length} eventos
          </span>
          {shown < filtered.length && (
            <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE)}>
              Mostrar más
            </Button>
          )}
        </div>
      </QueryState>
    </div>
  )
}
