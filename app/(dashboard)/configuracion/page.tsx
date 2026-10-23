"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { SiteConfigForm } from "@/components/site-config-form"
import { useSite } from "@/components/site-provider"

export default function ConfiguracionPage() {
  const { selected, current, sites, setSelected } = useSite()

  if (selected === "all") {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Configuración"
          description="La configuración es por sitio. Elegí uno en el selector de arriba o desde acá."
        />
        <div className="flex flex-wrap gap-2">
          {sites.map((s) => (
            <Button key={s.id} variant="outline" onClick={() => setSelected(s.id)}>
              {s.name}
            </Button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Configuración: ${current?.name ?? "…"}`}
        description="Modo de operación, umbral de anomalía e inventario de dispositivos del sitio."
        actions={
          <Button variant="outline" size="sm" render={<Link href={`/sitios/${selected}`} />}>
            Ver sitio
          </Button>
        }
      />
      <SiteConfigForm siteId={selected} />
    </div>
  )
}
