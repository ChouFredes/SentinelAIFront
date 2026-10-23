"use client"

import * as React from "react"
import { useSites } from "@/lib/api/queries"
import type { SiteView } from "@/lib/api/schemas"

/** "all" = todos los sitios. */
export type SiteSelection = "all" | number

interface SiteContextValue {
  selected: SiteSelection
  setSelected: (s: SiteSelection) => void
  sites: SiteView[]
  /** El sitio elegido, o undefined si está en "all" o todavía no cargó. */
  current: SiteView | undefined
  isLoading: boolean
}

const SiteContext = React.createContext<SiteContextValue | null>(null)
const STORAGE_KEY = "sentinel.site"

// La selección vive en localStorage; useSyncExternalStore evita leerlo durante el
// render del servidor (hidrata como "all" y después toma el valor guardado).
const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  window.addEventListener("storage", cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener("storage", cb)
  }
}

function readStored(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "all"
  } catch {
    return "all"
  }
}

function parseSelection(raw: string): SiteSelection {
  return /^\d+$/.test(raw) ? Number(raw) : "all"
}

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useSites()
  const sites = React.useMemo(() => data ?? [], [data])
  const stored = React.useSyncExternalStore(subscribe, readStored, () => "all")
  const selected = parseSelection(stored)

  const setSelected = React.useCallback((s: SiteSelection) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(s))
    } catch {
      /* sin storage: la selección no persiste */
    }
    listeners.forEach((cb) => cb())
  }, [])

  // Si el sitio guardado ya no existe, volvemos a "all".
  const valid = selected === "all" || sites.length === 0 || sites.some((s) => s.id === selected)
  const effective: SiteSelection = valid ? selected : "all"

  const value = React.useMemo<SiteContextValue>(
    () => ({
      selected: effective,
      setSelected,
      sites,
      current: effective === "all" ? undefined : sites.find((s) => s.id === effective),
      isLoading,
    }),
    [effective, setSelected, sites, isLoading],
  )
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

export function useSite(): SiteContextValue {
  const ctx = React.useContext(SiteContext)
  if (!ctx) throw new Error("useSite debe usarse dentro de <SiteProvider>")
  return ctx
}
