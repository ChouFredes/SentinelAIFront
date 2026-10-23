import { cn } from "@/lib/utils"
import { THRESHOLD } from "@/lib/mock-data"

/**
 * Thin inline bar showing an MSE score relative to the threshold τ.
 * Fills red when the score is above τ, slate when below. τ is marked
 * with a vertical tick.
 */
export function ScoreBar({
  score,
  threshold = THRESHOLD,
  maxDomain = 0.25,
  className,
}: {
  score: number
  threshold?: number
  maxDomain?: number
  className?: string
}) {
  const pct = Math.min((score / maxDomain) * 100, 100)
  const tauPct = Math.min((threshold / maxDomain) * 100, 100)
  const aboveThreshold = score >= threshold

  return (
    <div
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
      role="img"
      aria-label={`Score ${score.toFixed(4)}, umbral ${threshold.toFixed(4)}, ${
        aboveThreshold ? "por encima del umbral" : "por debajo del umbral"
      }`}
    >
      <div
        className={cn(
          "h-full rounded-full",
          aboveThreshold ? "bg-critical" : "bg-low"
        )}
        style={{ width: `${pct}%` }}
      />
      {/* τ marker */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 w-px bg-foreground/55"
        style={{ left: `${tauPct}%` }}
      />
    </div>
  )
}
