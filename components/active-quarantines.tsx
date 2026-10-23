"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Countdown } from "@/components/countdown"
import { RevertQuarantineButton } from "@/components/revert-quarantine-button"
import { QueryState } from "@/components/query-state"
import { useSite } from "@/components/site-provider"
import { useQuarantines } from "@/lib/api/queries"
import { formatMse } from "@/lib/format"

export function ActiveQuarantines({ siteId }: { siteId?: number }) {
  const query = useQuarantines(siteId)
  const { sites } = useSite()
  const siteName = (id: number) => sites.find((s) => s.id === id)?.name

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Cuarentenas activas</CardTitle>
        <CardDescription>IPs bloqueadas ahora mismo; se levantan solas al vencer</CardDescription>
      </CardHeader>
      <CardContent>
        <QueryState
          query={query}
          isEmpty={query.data?.length === 0}
          emptyMessage="No hay cuarentenas activas."
        >
          <ul className="flex flex-col divide-y divide-border">
            {query.data?.map((q) => (
              <li key={`${q.site_id}-${q.source_ip}`} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-mono text-sm font-medium">
                    {q.source_ip}
                    <span className="text-muted-foreground">
                      {" → "}
                      {q.destination_ip}:{q.destination_port}
                    </span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {siteName(q.site_id) ?? `Sitio ${q.site_id}`} · MSE {formatMse(q.mse_score)}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <Countdown expiresAt={q.expires_at} className="font-mono text-sm tabular-nums" />
                  <span className="text-[10px] text-muted-foreground uppercase">restante</span>
                </div>
                <RevertQuarantineButton sourceIp={q.source_ip} siteId={q.site_id} siteName={siteName(q.site_id)} />
              </li>
            ))}
          </ul>
        </QueryState>
      </CardContent>
    </Card>
  )
}
