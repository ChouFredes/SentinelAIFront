import type { AlertView, SiteSummary } from "@/lib/api/schemas"

const HOUR = 3_600_000

/** Arma el resumen de un sitio a partir de sus alertas (los mocks y el modo real usan la misma cuenta). */
export function computeSummary(
  alerts: AlertView[],
  siteId: number,
  hours: number,
  flowsAnalyzed: number,
  now = Date.now(),
): SiteSummary {
  const since = now - hours * HOUR
  const inWindow = alerts.filter((a) => a.site_id === siteId && Date.parse(a.occurred_at) >= since)

  const by_severity = { warning: 0, high: 0, critical: 0 }
  const sources = new Map<string, number>()
  const buckets = new Map<number, number>()
  const lastHour = Math.floor(now / HOUR) * HOUR
  for (let i = hours - 1; i >= 0; i--) buckets.set(lastHour - i * HOUR, 0)

  for (const a of inWindow) {
    by_severity[a.severity]++
    sources.set(a.source_ip, (sources.get(a.source_ip) ?? 0) + 1)
    const bucket = Math.floor(Date.parse(a.occurred_at) / HOUR) * HOUR
    if (buckets.has(bucket)) buckets.set(bucket, buckets.get(bucket)! + 1)
  }

  return {
    site_id: siteId,
    hours,
    total_alerts: inWindow.length,
    by_severity,
    by_hour: [...buckets.entries()].map(([t, count]) => ({ hour: new Date(t).toISOString(), count })),
    top_sources: [...sources.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([source_ip, count]) => ({ source_ip, count })),
    flows_analyzed: flowsAnalyzed,
  }
}
