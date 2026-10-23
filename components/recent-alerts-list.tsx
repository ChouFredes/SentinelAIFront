import Link from "next/link"
import { ChevronRight } from "lucide-react"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SeverityBadge } from "@/components/severity-badge"
import { AlertFlags } from "@/components/alert-flags"
import { formatMse, formatShortDateTime } from "@/lib/format"
import type { AlertView } from "@/lib/api/schemas"

export function RecentAlertsList({
  title = "Alertas críticas recientes",
  description = "Últimas detecciones críticas del motor",
  alerts,
  siteName,
}: {
  title?: string
  description?: string
  alerts: AlertView[]
  siteName?: (siteId: number) => string | undefined
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" render={<Link href="/alertas" />}>
            Ver todas
            <ChevronRight data-icon="inline-end" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {alerts.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">No hay alertas para mostrar.</p>
        )}
        {alerts.map((alert) => (
          <Link
            key={alert.id}
            href={`/alertas/${alert.id}`}
            className="group flex items-center gap-3 rounded-md px-2 py-2.5 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <SeverityBadge severity={alert.severity} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-mono text-sm font-medium">
                {alert.source_ip}
                <span className="text-muted-foreground">
                  {" → "}
                  {alert.destination_ip}:{alert.destination_port}
                </span>
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {formatShortDateTime(alert.occurred_at)} · MSE {formatMse(alert.mse_score)}
                {siteName?.(alert.site_id) ? ` · ${siteName(alert.site_id)}` : ""}
              </span>
            </div>
            <AlertFlags alert={alert} className="hidden sm:flex" />
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
