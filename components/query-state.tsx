"use client"

import * as React from "react"
import { AlertTriangle, Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api/client"

interface QueryLike {
  isLoading: boolean
  isError: boolean
  error: unknown
  refetch: () => unknown
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.detail
  return "Ocurrió un error inesperado."
}

/** Estados de carga / error / vacío para cualquier query. Renderiza `children` solo cuando hay datos. */
export function QueryState({
  query,
  isEmpty,
  emptyMessage = "No hay datos para mostrar.",
  skeleton,
  children,
}: {
  query: QueryLike
  isEmpty?: boolean
  emptyMessage?: string
  skeleton?: React.ReactNode
  children: React.ReactNode
}) {
  if (query.isLoading) {
    return (
      <>
        {skeleton ?? (
          <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        )}
      </>
    )
  }
  if (query.isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-lg border border-critical/30 bg-critical/8 p-4 text-sm"
      >
        <div className="flex items-center gap-2 font-medium text-critical-foreground">
          <AlertTriangle className="size-4" />
          No se pudieron cargar los datos
        </div>
        <p className="text-muted-foreground">{errorMessage(query.error)}</p>
        <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
          Reintentar
        </Button>
      </div>
    )
  }
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-sm text-muted-foreground">
        <Inbox className="size-5" />
        {emptyMessage}
      </div>
    )
  }
  return <>{children}</>
}
