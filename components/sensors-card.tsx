"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useNow } from "@/components/countdown"
import { cn } from "@/lib/utils"
import { SENSOR_STATUS_LABEL, latestSensorActivity, sensorStatus, type SensorStatus } from "@/lib/domain"
import { formatInt, formatRelative } from "@/lib/format"
import type { SiteSensorView } from "@/lib/api/schemas"

const STATUS_STYLE: Record<SensorStatus, string> = {
  online: "border-success/30 bg-success/12 text-success-foreground",
  link_degraded: "border-high/30 bg-high/12 text-high-foreground",
  offline: "border-critical/30 bg-critical/12 text-critical-foreground",
}

export function SensorStatusBadge({ sensor }: { sensor: SiteSensorView }) {
  const now = useNow(10_000)
  const status = sensorStatus(sensor, now)
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_STYLE[status])}>
      {SENSOR_STATUS_LABEL[status]}
    </Badge>
  )
}

export function SensorsCard({
  sensors,
  siteName,
  className,
}: {
  sensors: SiteSensorView[]
  siteName?: (siteId: number) => string | undefined
  className?: string
}) {
  return (
    <Card className={className ?? "h-full"}>
      <CardHeader>
        <CardTitle>Sensores</CardTitle>
        <CardDescription>Latido y estado del enlace</CardDescription>
      </CardHeader>
      <CardContent>
        {sensors.length === 0 && <p className="text-sm text-muted-foreground">Sin sensores registrados.</p>}
        <ul className="flex flex-col divide-y divide-border">
          {sensors.map((s) => (
            <li key={s.sensor_id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {s.name}
                  {siteName?.(s.site_id) && (
                    <span className="font-normal text-muted-foreground"> · {siteName(s.site_id)}</span>
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {latestSensorActivity(s) ? `Última actividad ${formatRelative(latestSensorActivity(s)!)}` : "Sin actividad"} ·{" "}
                  {formatInt(s.flow_count)} flujos
                </span>
              </div>
              <SensorStatusBadge sensor={s} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
