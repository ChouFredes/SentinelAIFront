import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { SEVERITY_LABEL, type Severity } from "@/lib/mock-data"

const SEVERITY_STYLES: Record<Severity, string> = {
  critica: "border-critical/30 bg-critical/12 text-critical-foreground",
  alta: "border-high/30 bg-high/12 text-high-foreground",
  media: "border-medium/30 bg-medium/12 text-medium-foreground",
  baja: "border-low/30 bg-low/12 text-low-foreground",
}

const SEVERITY_DOT: Record<Severity, string> = {
  critica: "bg-critical",
  alta: "bg-high",
  media: "bg-medium",
  baja: "bg-low",
}

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium", SEVERITY_STYLES[severity], className)}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", SEVERITY_DOT[severity])}
      />
      {SEVERITY_LABEL[severity]}
    </Badge>
  )
}
