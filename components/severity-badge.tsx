import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { SEVERITY_LABEL } from "@/lib/domain"
import type { Severity } from "@/lib/api/schemas"

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: "border-critical/30 bg-critical/12 text-critical-foreground",
  high: "border-high/30 bg-high/12 text-high-foreground",
  warning: "border-medium/30 bg-medium/12 text-medium-foreground",
}

const SEVERITY_DOT: Record<Severity, string> = {
  critical: "bg-critical",
  high: "bg-high",
  warning: "bg-medium",
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
