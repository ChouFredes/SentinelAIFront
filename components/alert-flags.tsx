import { HelpCircle, Unplug, Eye, ShieldCheck } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { AlertView } from "@/lib/api/schemas"

const FLAGS = [
  { key: "unrecognized_device", label: "Dispositivo no reconocido", icon: HelpCircle, color: "text-medium-foreground" },
  { key: "link_degraded", label: "Enlace degradado", icon: Unplug, color: "text-high-foreground" },
  { key: "informative_only_mode", label: "Modo informativo (no bloquea)", icon: Eye, color: "text-primary" },
  { key: "mitigation_applied", label: "Mitigación aplicada", icon: ShieldCheck, color: "text-success-foreground" },
] as const

export function AlertFlags({ alert, className }: { alert: AlertView; className?: string }) {
  const active = FLAGS.filter((f) => alert[f.key])
  if (active.length === 0) return <span className="text-muted-foreground">—</span>
  return (
    <ul className={cn("flex items-center gap-1.5", className)} aria-label="Indicadores de la alerta">
      {active.map(({ key, label, icon: Icon, color }) => (
        <li key={key}>
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  className={cn("inline-flex size-6 items-center justify-center rounded-md bg-muted/60", color)}
                  aria-label={label}
                />
              }
            >
              <Icon className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        </li>
      ))}
    </ul>
  )
}
