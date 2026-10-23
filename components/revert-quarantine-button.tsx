"use client"

import * as React from "react"
import { Undo2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ApiError } from "@/lib/api/client"
import { useRevertQuarantine } from "@/lib/api/queries"

export function revertErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "No se pudo revertir la cuarentena."
  switch (error.status) {
    case 404:
      return "Ya no hay una cuarentena activa para esa IP: venció o la revirtió otra persona."
    case 409:
      return "El estado cambió mientras confirmabas. Actualizamos la lista: revisala y volvé a intentar."
    case 503:
      return "El firewall o la base de datos no respondieron. Probá de nuevo en unos segundos."
    default:
      return error.detail
  }
}

export function RevertQuarantineButton({
  sourceIp,
  siteId,
  siteName,
  label = "Revertir",
  size = "sm",
}: {
  sourceIp: string
  siteId: number
  siteName?: string
  label?: string
  size?: "sm" | "default"
}) {
  const [open, setOpen] = React.useState(false)
  const revert = useRevertQuarantine()

  function confirm() {
    revert.mutate(
      { sourceIp, siteId },
      {
        onSuccess: (res) => {
          setOpen(false)
          toast.success(
            res.rule_was_present
              ? `Cuarentena de ${sourceIp} revertida.`
              : `La cuarentena de ${sourceIp} se dio de baja (la regla ya no estaba en el firewall).`,
          )
        },
        onError: (err) => {
          setOpen(false)
          toast.error(revertErrorMessage(err))
        },
      },
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => !revert.isPending && setOpen(v)}>
      <AlertDialogTrigger render={<Button size={size} />}>
        <Undo2 data-icon="inline-start" />
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Revertir la cuarentena?</AlertDialogTitle>
          <AlertDialogDescription>
            Se va a quitar la regla de iptables que bloquea a{" "}
            <span className="font-mono text-foreground">{sourceIp}</span>
            {siteName ? ` en ${siteName}` : ""}. Queda registrado como reversión manual en la auditoría.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={revert.isPending}>Cancelar</AlertDialogCancel>
          <Button onClick={confirm} disabled={revert.isPending}>
            {revert.isPending ? "Revirtiendo…" : "Revertir cuarentena"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
