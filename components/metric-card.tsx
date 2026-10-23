import { ArrowUp, ArrowDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { MetricCard as MetricCardData } from "@/lib/mock-data"

export function MetricCard({ metric }: { metric: MetricCardData }) {
  const { deltaPct, higherIsBetter } = metric
  const isUp = deltaPct > 0
  const isFlat = deltaPct === 0
  // A change is "good" when its direction matches higherIsBetter.
  const isGood = isFlat ? true : isUp === higherIsBetter

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {metric.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-2">
        <span className="font-mono text-3xl leading-none font-semibold tracking-tight tabular-nums">
          {metric.value}
        </span>
        <span
          className={cn(
            "flex items-center gap-0.5 font-mono text-xs tabular-nums",
            isFlat
              ? "text-muted-foreground"
              : isGood
                ? "text-success-foreground"
                : "text-high-foreground"
          )}
        >
          {!isFlat &&
            (isUp ? (
              <ArrowUp className="size-3.5" />
            ) : (
              <ArrowDown className="size-3.5" />
            ))}
          {isFlat ? "0%" : `${isUp ? "+" : ""}${deltaPct}%`}
          <span className="sr-only">
            {isFlat
              ? "sin cambios respecto al período anterior"
              : `${isUp ? "aumento" : "disminución"} respecto al período anterior`}
          </span>
        </span>
      </CardContent>
    </Card>
  )
}
