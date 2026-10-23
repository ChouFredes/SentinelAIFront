"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { QueryState } from "@/components/query-state"
import { SensorStatusBadge } from "@/components/sensors-card"
import { useSites, useSiteSensors } from "@/lib/api/queries"
import { formatTau } from "@/lib/format"
import { TAU } from "@/lib/domain"
import type { SiteView } from "@/lib/api/schemas"

function SiteCard({ site }: { site: SiteView }) {
  const sensors = useSiteSensors(site.id)
  const { config } = site
  return (
    <Link
      href={`/sitios/${site.id}`}
      className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="h-full transition-colors group-hover:bg-accent/30">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            {site.name}
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </CardTitle>
          <CardDescription>{site.is_active ? "Sitio activo" : "Sitio inactivo"}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className={config.informative_only_mode ? "border-primary/30 bg-primary/10 text-primary" : "border-success/30 bg-success/12 text-success-foreground"}>
              {config.informative_only_mode ? "Modo informativo" : "Modo activo"}
            </Badge>
            <Badge variant="outline" className="border-border text-muted-foreground">
              Respuesta {config.active_response_enabled ? "habilitada" : "deshabilitada"}
            </Badge>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Umbral MSE</dt>
              <dd className="font-mono">
                {formatTau(config.custom_mse_threshold ?? TAU)}
                {config.custom_mse_threshold === null && <span className="text-muted-foreground"> (τ)</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Inventario</dt>
              <dd>{config.known_devices.length === 1 ? "1 rango" : `${config.known_devices.length} rangos`}</dd>
            </div>
          </dl>
          <div className="flex flex-col gap-1.5">
            {sensors.data?.map((s) => (
              <div key={s.sensor_id} className="flex items-center justify-between text-sm">
                <span>{s.name}</span>
                <SensorStatusBadge sensor={s} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function SitiosPage() {
  const sites = useSites()
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Sitios" description="Sitios a cargo, con su modo de operación y el estado de sus sensores." />
      <QueryState query={sites} isEmpty={sites.data?.length === 0} emptyMessage="Todavía no hay sitios registrados.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sites.data?.map((s) => <SiteCard key={s.id} site={s} />)}
        </div>
      </QueryState>
    </div>
  )
}
