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
import { StatusBadge } from "@/components/status-badge"
import { RECENT_ALERTS, formatTimestamp } from "@/lib/mock-data"

export function RecentAlertsList() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Alertas recientes</CardTitle>
        <CardDescription>Últimas detecciones del motor</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" render={<Link href="/alertas" />}>
            Ver todas
            <ChevronRight data-icon="inline-end" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {RECENT_ALERTS.map((alert) => (
          <Link
            key={alert.id}
            href={`/alertas/${alert.id}`}
            className="group flex items-center gap-3 rounded-md px-2 py-2.5 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <SeverityBadge severity={alert.severity} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">
                {alert.attackType}
                <span className="text-muted-foreground">
                  {" · "}
                  {alert.srcIp} → {alert.dstIp}:{alert.port}
                </span>
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {formatTimestamp(alert.timestamp)} · {alert.id}
              </span>
            </div>
            <StatusBadge status={alert.status} className="hidden sm:inline-flex" />
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
