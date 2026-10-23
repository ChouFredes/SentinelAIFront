import { cn } from "@/lib/utils"
import { CRITICAL_FACTOR, TAU } from "@/lib/domain"
import { formatMse, formatTau } from "@/lib/format"

const DOMAIN_FACTOR = 5

/**
 * Barra fina con el MSE de un flujo relativo al umbral τ del sitio. La escala
 * llega hasta 5τ y satura: τ y 3τ (desde donde puede ser critical) van marcados.
 */
export function ScoreBar({
  score,
  threshold = TAU,
  className,
}: {
  score: number
  threshold?: number
  className?: string
}) {
  const max = threshold * DOMAIN_FACTOR
  const pct = Math.min((score / max) * 100, 100)
  const tauPct = (threshold / max) * 100
  const criticalPct = ((threshold * CRITICAL_FACTOR) / max) * 100
  const above = score >= threshold

  return (
    <div
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="img"
      aria-label={`MSE ${formatMse(score)}, umbral ${formatTau(threshold)}, ${
        above ? "por encima del umbral" : "por debajo del umbral"
      }`}
    >
      <div
        className={cn("h-full rounded-full", above ? "bg-critical" : "bg-low")}
        style={{ width: `${pct}%` }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 w-px bg-foreground/55"
        style={{ left: `${tauPct}%` }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 w-px bg-foreground/30"
        style={{ left: `${criticalPct}%` }}
      />
    </div>
  )
}
