"use client"

import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { ALERTS, SEVERITY_LABEL, type Severity } from "@/lib/mock-data"

const ORDER: Severity[] = ["critica", "alta", "media", "baja"]

const SEVERITY_COLOR: Record<Severity, string> = {
  critica: "var(--critical)",
  alta: "var(--high)",
  media: "var(--medium)",
  baja: "var(--low)",
}

const data = ORDER.map((severity) => ({
  severity,
  label: SEVERITY_LABEL[severity],
  count: ALERTS.filter((a) => a.severity === severity).length,
  fill: SEVERITY_COLOR[severity],
}))

const config = {
  count: { label: "Alertas" },
} satisfies ChartConfig

export function SeverityBarChart() {
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{ left: 8, right: 28, top: 4, bottom: 4 }}
      >
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={64}
          className="text-[12px]"
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          content={<ChartTooltipContent hideIndicator />}
        />
        <Bar dataKey="count" radius={4} barSize={22}>
          {data.map((d) => (
            <Cell key={d.severity} fill={d.fill} />
          ))}
          <LabelList
            dataKey="count"
            position="right"
            className="fill-foreground font-mono text-[11px]"
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
