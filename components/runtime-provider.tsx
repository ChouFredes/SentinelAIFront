"use client"

import * as React from "react"

/** Datos del servidor que la interfaz necesita saber (se calculan en el layout del dashboard). */
export interface RuntimeInfo {
  /** SENTINEL_USE_MOCKS=true: todo el panel muestra datos simulados. */
  mocks: boolean
  /** Modo real, pero los flujos (RF-06) todavía son de ejemplo: el backend no los expone. */
  flowsPending: boolean
}

const RuntimeContext = React.createContext<RuntimeInfo | null>(null)

export function RuntimeProvider({ value, children }: { value: RuntimeInfo; children: React.ReactNode }) {
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>
}

export function useRuntime(): RuntimeInfo {
  const ctx = React.useContext(RuntimeContext)
  if (!ctx) throw new Error("useRuntime debe usarse dentro de <RuntimeProvider>")
  return ctx
}
