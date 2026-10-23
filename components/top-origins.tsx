import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { isPrivateIp } from "@/lib/cidr"
import { formatInt } from "@/lib/format"

export function TopOrigins({
  sources,
  hours,
}: {
  sources: { source_ip: string; count: number }[]
  hours: number
}) {
  const max = Math.max(1, ...sources.map((o) => o.count))

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Orígenes más frecuentes</CardTitle>
        <CardDescription>IPs con más alertas ({hours} h)</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {sources.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin alertas en el período.</p>
        )}
        {sources.map((origin) => {
          const isPrivate = isPrivateIp(origin.source_ip)
          return (
            <div key={origin.source_ip} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">{origin.source_ip}</span>
                  <Badge
                    variant="outline"
                    className="border-border text-[10px] text-muted-foreground uppercase"
                  >
                    {isPrivate ? "privada" : "pública"}
                  </Badge>
                </div>
                <span className="font-mono text-sm tabular-nums text-muted-foreground">
                  {formatInt(origin.count)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={isPrivate ? "h-full rounded-full bg-primary" : "h-full rounded-full bg-high"}
                  style={{ width: `${(origin.count / max) * 100}%` }}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
