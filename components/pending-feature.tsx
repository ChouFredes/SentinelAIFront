import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * Algo que está en los wireframes pero el backend todavía no soporta
 * (ver docs/backend-pendiente.md). Se dibuja deshabilitado y con aviso; nunca
 * simula una escritura.
 */
export function PendingBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-medium/30 bg-medium/12 text-medium-foreground", className)}>
      pendiente
    </Badge>
  )
}

export function PendingFeature({
  title,
  note,
  children,
  className,
}: {
  title?: string
  note?: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {(title || note) && (
        <div className="flex flex-wrap items-center gap-2">
          {title && <span className="text-sm font-medium">{title}</span>}
          <PendingBadge />
        </div>
      )}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {children && (
        <div aria-disabled="true" inert className="pointer-events-none opacity-50 select-none">
          {children}
        </div>
      )}
    </div>
  )
}
