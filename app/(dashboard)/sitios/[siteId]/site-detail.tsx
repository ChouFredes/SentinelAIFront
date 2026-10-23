"use client"

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { PageHeader } from "@/components/page-header"
import { SensorStatusBadge } from "@/components/sensors-card"
import { SiteConfigForm } from "@/components/site-config-form"
import { useSite } from "@/components/site-provider"
import { useSiteSensors } from "@/lib/api/queries"

export function SiteDetail({ siteId }: { siteId: number }) {
  const { sites, isLoading } = useSite()
  const site = sites.find((s) => s.id === siteId)
  const sensors = useSiteSensors(siteId)

  if (!isLoading && !site) {
    return <PageHeader title="Sitio no encontrado" description="Ese sitio no existe o no tenés acceso." />
  }

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/sitios">Sitios</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{site?.name ?? "…"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader
        title={`Configuración del sitio: ${site?.name ?? "…"}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {sensors.data?.map((s) => (
              <span key={s.sensor_id} className="inline-flex items-center gap-1.5">
                {s.name} <SensorStatusBadge sensor={s} />
              </span>
            ))}
          </span>
        }
      />
      <SiteConfigForm siteId={siteId} />
    </div>
  )
}
