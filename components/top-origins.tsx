import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TOP_ORIGINS, formatInt } from "@/lib/mock-data"

export function TopOrigins() {
  const max = Math.max(...TOP_ORIGINS.map((o) => o.count))

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Orígenes más frecuentes</CardTitle>
        <CardDescription>IPs con más flujos anómalos (24 h)</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {TOP_ORIGINS.map((origin) => (
          <div key={origin.ip} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{origin.ip}</span>
                <Badge
                  variant="outline"
                  className="border-border text-[10px] text-muted-foreground uppercase"
                >
                  {origin.scope}
                </Badge>
              </div>
              <span className="font-mono text-sm tabular-nums text-muted-foreground">
                {formatInt(origin.count)}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={
                  origin.scope === "pública"
                    ? "h-full rounded-full bg-high"
                    : "h-full rounded-full bg-primary"
                }
                style={{ width: `${(origin.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
