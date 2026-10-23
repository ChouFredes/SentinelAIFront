"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { SimpleSelect } from "@/components/simple-select"
import { useSite } from "@/components/site-provider"

export function SiteSelect({ className }: { className?: string }) {
  const { selected, setSelected, sites, isLoading } = useSite()
  if (isLoading) return <Skeleton className="h-7 w-44" />
  return (
    <SimpleSelect
      ariaLabel="Seleccionar sitio"
      className={className ?? "w-48"}
      value={String(selected)}
      onValueChange={(v) => setSelected(v === "all" ? "all" : Number(v))}
      options={[
        { value: "all", label: "Todos los sitios" },
        ...sites.map((s) => ({ value: String(s.id), label: s.name })),
      ]}
    />
  )
}
