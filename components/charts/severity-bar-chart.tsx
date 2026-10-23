"use client"

import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { SEVERITY_LABEL, SEVERITY_ORDER } from "@/lib/domain"
import type { Severity } from "@/lib/api/schemas"

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "var(--critical)",
  high: "var(--high)",
  warning: "var(--medium)",
}

const config = {
  count: { label: "Alertas" },
} satisfies ChartConfig

export function SeverityBarChart({ counts }: { counts: Record<Severity, number> }) {
  const data = SEVERITY_ORDER.map((severity) => ({
    severity,
    label: SEVERITY_LABEL[severity],
    count: counts[severity],
    fill: SEVERITY_COLOR[severity],
  }))
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
          width={84}
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
