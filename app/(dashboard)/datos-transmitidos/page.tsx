"use client"

import * as React from "react"
import { Check, Download, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { PendingFeature } from "@/components/pending-feature"
import { QueryState } from "@/components/query-state"
import { SimpleSelect } from "@/components/simple-select"
import { useRuntime } from "@/components/runtime-provider"
import { useSite } from "@/components/site-provider"
import { useFlows, useSensorsOfSites } from "@/lib/api/queries"
import type { FlowSample } from "@/lib/api/schemas"
import { downloadFile } from "@/lib/csv"
import { TRANSMITTED_FIELDS } from "@/lib/domain"
import { formatDateTime, formatInt } from "@/lib/format"

const SAMPLE_SIZE = 5
const SHOWN_FEATURES = 4

/** Una línea por registro, con las primeras características (la descarga trae todas). */
function previewLine(flow: FlowSample): string {
  const total = Object.keys(flow.features).length
  const features = Object.fromEntries(Object.entries(flow.features).slice(0, SHOWN_FEATURES))
  const line = JSON.stringify({ ...flow, features })
  return total > SHOWN_FEATURES ? line.replace(/\}\}$/, ",...}}") : line
}

export default function DatosTransmitidosPage() {
  const { selected, sites } = useSite()
  const { flowsPending } = useRuntime()
  const siteIds = React.useMemo(() => (selected === "all" ? sites.map((s) => s.id) : [selected]), [selected, sites])
  const sensorQueries = useSensorsOfSites(siteIds)
  const sensors = sensorQueries.flatMap((q) => q.data ?? [])
  const siteName = (id: number) => sites.find((s) => s.id === id)?.name ?? `Sitio ${id}`

  const [chosen, setChosen] = React.useState<number | undefined>()
  // Si el sensor elegido ya no está en la lista (cambió el sitio), se toma el primero.
  const sensor = sensors.find((s) => s.sensor_id === chosen) ?? sensors[0]
  const flows = useFlows(sensor?.sensor_id, SAMPLE_SIZE)

  const sampleContent = (
    <QueryState query={flows} isEmpty={flows.data?.length === 0} emptyMessage="El sensor todavía no envió registros.">
      <pre
        tabIndex={0}
        aria-label="Muestra JSON de registros"
        className="max-h-72 overflow-auto rounded-md bg-muted/50 p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap"
      >
        {flows.data?.map(previewLine).join("\n")}
      </pre>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadFile(
              `muestra-${sensor?.name ?? "sensor"}.json`,
              JSON.stringify(flows.data, null, 2),
              "application/json",
            )
          }
        >
          <Download data-icon="inline-start" />
          Descargar muestra JSON
        </Button>
        <span className="text-xs text-muted-foreground">
          Se muestran {SHOWN_FEATURES} características por registro; la descarga trae todas.
        </span>
      </div>
    </QueryState>
  )
  // En modo real los flujos todavía no vienen del backend: la muestra es de ejemplo y se muestra deshabilitada.
  const sample = flowsPending ? (
    <PendingFeature
      title="Muestra de los últimos registros"
      note="El backend todavía no expone los flujos: los registros son de ejemplo."
    >
      {sampleContent}
    </PendingFeature>
  ) : (
    sampleContent
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Datos transmitidos por el sensor"
        description={
          sensor
            ? `${sensor.name} · ${siteName(sensor.site_id)} · campos enviados al motor centralizado`
            : "Qué envía cada sensor al motor centralizado."
        }
        actions={
          sensors.length > 1 ? (
            <SimpleSelect
              ariaLabel="Seleccionar sensor"
              className="w-56"
              value={String(sensor?.sensor_id)}
              onValueChange={(v) => setChosen(Number(v))}
              options={sensors.map((s) => ({ value: String(s.sensor_id), label: `${s.name} · ${siteName(s.site_id)}` }))}
            />
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Campos recibidos</CardTitle>
            <CardDescription>Características del flujo y direcciones; nunca el contenido de los paquetes</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="flex flex-col gap-2">
              {TRANSMITTED_FIELDS.map((f) => (
                <li key={f.label} className="flex items-start gap-2 text-sm">
                  {f.sent ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-success-foreground" aria-label="Se envía" />
                  ) : (
                    <X className="mt-0.5 size-4 shrink-0 text-critical-foreground" aria-label="No se envía" />
                  )}
                  <span className={f.sent ? undefined : "font-semibold"}>{f.label}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Sin carga útil</Badge>
              <Badge variant="outline">Token por sensor</Badge>
            </div>
            {sensor && (
              <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Flujos recibidos</dt>
                  <dd className="font-mono">{formatInt(sensor.flow_count)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Último envío</dt>
                  <dd className="font-mono">{sensor.last_ingest_at ? formatDateTime(sensor.last_ingest_at) : "—"}</dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Muestra de los últimos registros recibidos</CardTitle>
            <CardDescription>Tal como llegan al backend</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {sample}
            <PendingFeature
              title="Volumen transmitido (últimas 24 h)"
              note="El backend todavía no expone el volumen por hora; hoy solo informa el total de flujos."
            >
              <div className="h-28 rounded-md border border-dashed border-border bg-[repeating-linear-gradient(135deg,transparent,transparent_8px,var(--muted)_8px,var(--muted)_16px)]" />
            </PendingFeature>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
