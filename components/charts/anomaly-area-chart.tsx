"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatDayHour, formatHour } from "@/lib/format"

const config = {
  count: {
    label: "Alertas",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function AnomalyAreaChart({ data }: { data: { hour: string; count: number }[] }) {
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <AreaChart
        accessibilityLayer
        data={data}
        margin={{ left: -12, right: 8, top: 8, bottom: 0 }}
      >
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="hour"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(v: string) => formatHour(v)}
          className="font-mono text-[11px]"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={36}
          allowDecimals={false}
          className="font-mono text-[11px]"
        />
        <ChartTooltip
          cursor={{ stroke: "var(--border)" }}
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(v) => formatDayHour(String(v))}
            />
          }
        />
        <Area
          dataKey="count"
          type="monotone"
          stroke="var(--color-count)"
          strokeWidth={2}
          fill="var(--color-count)"
          fillOpacity={0.12}
          dot={false}
          activeDot={{ r: 3 }}
        />
      </AreaChart>
    </ChartContainer>
  )
}
