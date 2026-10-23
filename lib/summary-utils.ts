import type { SiteSummary } from "@/lib/api/schemas"

/** Suma los resúmenes de varios sitios (vista "Todos los sitios"). */
export function mergeSummaries(list: SiteSummary[]): SiteSummary | undefined {
  if (list.length === 0) return undefined
  const byHour = new Map<string, number>()
  const sources = new Map<string, number>()
  const out: SiteSummary = {
    site_id: 0,
    hours: list[0].hours,
    total_alerts: 0,
    by_severity: { warning: 0, high: 0, critical: 0 },
    by_hour: [],
    top_sources: [],
    flows_analyzed: 0,
  }
  for (const s of list) {
    out.total_alerts += s.total_alerts
    out.flows_analyzed += s.flows_analyzed
    out.by_severity.warning += s.by_severity.warning
    out.by_severity.high += s.by_severity.high
    out.by_severity.critical += s.by_severity.critical
    for (const h of s.by_hour) byHour.set(h.hour, (byHour.get(h.hour) ?? 0) + h.count)
    for (const t of s.top_sources) sources.set(t.source_ip, (sources.get(t.source_ip) ?? 0) + t.count)
  }
  out.by_hour = [...byHour.entries()]
    .sort(([a], [b]) => Date.parse(a) - Date.parse(b))
    .map(([hour, count]) => ({ hour, count }))
  out.top_sources = [...sources.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([source_ip, count]) => ({ source_ip, count }))
  return out
}
