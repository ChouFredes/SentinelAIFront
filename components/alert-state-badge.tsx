import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ALERT_STATE_LABEL, type AlertState } from "@/lib/domain"

const STYLE: Record<AlertState, string> = {
  quarantine_active: "border-critical/30 bg-critical/12 text-critical-foreground",
  reverted_manual: "border-border bg-muted/50 text-muted-foreground",
  reverted_timer: "border-border bg-muted/50 text-muted-foreground",
  suspended_link: "border-high/30 bg-high/12 text-high-foreground",
  informative: "border-primary/30 bg-primary/10 text-primary",
  detected: "border-border bg-muted/50 text-muted-foreground",
}

export function AlertStateBadge({
  state,
  children,
  className,
}: {
  state: AlertState
  children?: React.ReactNode
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn("font-medium", STYLE[state], className)}>
      {ALERT_STATE_LABEL[state]}
      {children}
    </Badge>
  )
}
