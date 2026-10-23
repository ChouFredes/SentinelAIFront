import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { STATUS_LABEL, type AlertStatus } from "@/lib/mock-data"

const STATUS_STYLES: Record<AlertStatus, string> = {
  activa: "border-primary/30 bg-primary/10 text-primary",
  mitigada: "border-success/30 bg-success/12 text-success-foreground",
  descartada: "border-border bg-muted/50 text-muted-foreground",
  falso_positivo: "border-border bg-muted/50 text-muted-foreground",
}

export function StatusBadge({
  status,
  className,
}: {
  status: AlertStatus
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", STATUS_STYLES[status], className)}
    >
      {STATUS_LABEL[status]}
    </Badge>
  )
}
