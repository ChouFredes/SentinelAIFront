"use client"

import * as React from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/page-header"
import { PendingFeature } from "@/components/pending-feature"
import { QueryState } from "@/components/query-state"
import { SeverityBadge } from "@/components/severity-badge"
import { SimpleSelect } from "@/components/simple-select"
import { useSite } from "@/components/site-provider"
import { ApiError } from "@/lib/api/client"
import { useAlerts, useUpdateSiteConfig } from "@/lib/api/queries"
import type { AlertView, Severity, SiteView } from "@/lib/api/schemas"
import { CIDR_ERROR_MESSAGE, hostCidr, ipInCidrs, validateNewCidr } from "@/lib/cidr"
import { severityRank } from "@/lib/domain"
import { formatInt, formatShortDateTime, parseIso } from "@/lib/format"

interface DeviceGroup {
  key: string
  siteId: number
  ip: string
  count: number
  firstSeen: string
  lastSeen: string
  severity: Severity
}

function groupByDevice(alerts: AlertView[]): DeviceGroup[] {
  const groups = new Map<string, DeviceGroup>()
  for (const a of alerts) {
    const key = `${a.site_id}|${a.source_ip}`
    const g = groups.get(key)
    if (!g) {
      groups.set(key, {
        key,
        siteId: a.site_id,
        ip: a.source_ip,
        count: 1,
        firstSeen: a.occurred_at,
        lastSeen: a.occurred_at,
        severity: a.severity,
      })
      continue
    }
    g.count++
    if (parseIso(a.occurred_at).getTime() < parseIso(g.firstSeen).getTime()) g.firstSeen = a.occurred_at
    if (parseIso(a.occurred_at).getTime() > parseIso(g.lastSeen).getTime()) g.lastSeen = a.occurred_at
    if (severityRank(a.severity) > severityRank(g.severity)) g.severity = a.severity
  }
  return [...groups.values()].sort((a, b) => parseIso(b.lastSeen).getTime() - parseIso(a.lastSeen).getTime())
}

function AddToInventory({ site, ip }: { site: SiteView; ip: string }) {
  const [open, setOpen] = React.useState(false)
  const update = useUpdateSiteConfig(site.id)
  const cidr = hostCidr(ip)
  const blocked = cidr ? validateNewCidr(cidr, site.config.known_devices) : "invalid"

  function confirm() {
    if (!cidr) return
    update.mutate(
      { known_devices: [...site.config.known_devices, cidr] },
      {
        onSuccess: () => {
          setOpen(false)
          toast.success(`${ip} se agregó al inventario de ${site.name}.`)
        },
        onError: (e) => {
          setOpen(false)
          toast.error(e instanceof ApiError ? e.detail : "No se pudo agregar al inventario.")
        },
      },
    )
  }

  if (blocked) {
    return <span className="text-xs text-muted-foreground">{CIDR_ERROR_MESSAGE[blocked]}</span>
  }
  return (
    <AlertDialog open={open} onOpenChange={(v) => !update.isPending && setOpen(v)}>
      <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus data-icon="inline-start" />
        Agregar al inventario
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Agregar al inventario?</AlertDialogTitle>
          <AlertDialogDescription>
            Se va a registrar <span className="font-mono text-foreground">{cidr}</span> como dispositivo conocido de{" "}
            {site.name}. Dejará de generar alertas de dispositivo no reconocido.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={update.isPending}>Cancelar</AlertDialogCancel>
          <Button onClick={confirm} disabled={update.isPending}>
            {update.isPending ? "Guardando…" : "Agregar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default function DispositivosPage() {
  const { selected, setSelected, sites } = useSite()
  const siteId = selected === "all" ? undefined : selected
  const [status, setStatus] = React.useState<"all" | "unknown" | "inventory">("all")

  const alerts = useAlerts({ site_id: siteId, unrecognized_device: true, limit: 1000 })
  const groups = React.useMemo(() => groupByDevice(alerts.data?.items ?? []), [alerts.data])
  const siteOf = (id: number) => sites.find((s) => s.id === id)

  const rows = groups
    .map((g) => {
      const site = siteOf(g.siteId)
      return { g, site, inInventory: site ? ipInCidrs(g.ip, site.config.known_devices) : false }
    })
    .filter((r) => status === "all" || (status === "inventory") === r.inInventory)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Dispositivos no reconocidos"
        description="Orígenes privados que generaron alertas por estar fuera del inventario de dispositivos del sitio."
      />

      <div className="flex flex-wrap items-center gap-2">
        <SimpleSelect
          ariaLabel="Filtrar por sitio"
          className="w-44"
          value={String(selected)}
          onValueChange={(v) => setSelected(v === "all" ? "all" : Number(v))}
          options={[{ value: "all", label: "Sitio: todos" }, ...sites.map((s) => ({ value: String(s.id), label: s.name }))]}
        />
        <SimpleSelect
          ariaLabel="Filtrar por estado"
          className="w-48"
          value={status}
          onValueChange={(v) => setStatus(v as typeof status)}
          options={[
            { value: "all", label: "Estado: todos" },
            { value: "unknown", label: "No reconocidos" },
            { value: "inventory", label: "Ya en inventario" },
          ]}
        />
      </div>

      <QueryState query={alerts} isEmpty={groups.length === 0} emptyMessage="No hay alertas de dispositivos no reconocidos.">
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estado</TableHead>
                <TableHead>IP</TableHead>
                {selected === "all" && <TableHead>Sitio</TableHead>}
                <TableHead>Alertas</TableHead>
                <TableHead>Mayor severidad</TableHead>
                <TableHead>Visto por primera vez</TableHead>
                <TableHead>Última vez</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={selected === "all" ? 8 : 7} className="py-8 text-center text-muted-foreground">
                    Ningún dispositivo coincide con el estado elegido.
                  </TableCell>
                </TableRow>
              )}
              {rows.map(({ g, site, inInventory }) => (
                <TableRow key={g.key}>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        inInventory
                          ? "border-success/30 bg-success/12 text-success-foreground"
                          : "border-medium/30 bg-medium/12 text-medium-foreground"
                      }
                    >
                      {inInventory ? "En inventario" : "No reconocido"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{g.ip}</TableCell>
                  {selected === "all" && <TableCell>{site?.name ?? `Sitio ${g.siteId}`}</TableCell>}
                  <TableCell className="font-mono tabular-nums">{formatInt(g.count)}</TableCell>
                  <TableCell>
                    <SeverityBadge severity={g.severity} />
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                    {formatShortDateTime(g.firstSeen)}
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                    {formatShortDateTime(g.lastSeen)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={`/alertas?ip=${encodeURIComponent(g.ip)}&periodo=all`} />}
                      >
                        Ver alertas
                      </Button>
                      {!inInventory && site && <AddToInventory site={site} ip={g.ip} />}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </QueryState>

      <PendingFeature note="Nombre del dispositivo y estados Nuevo / Aprobado / Sospechoso: el backend todavía no tiene la entidad dispositivo; hoy solo se agrupan las alertas por IP." />
    </div>
  )
}
