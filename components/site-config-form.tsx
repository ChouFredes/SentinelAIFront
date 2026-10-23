"use client"

import * as React from "react"
import { Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PendingFeature } from "@/components/pending-feature"
import { QueryState } from "@/components/query-state"
import { ApiError } from "@/lib/api/client"
import { useSiteConfig, useUpdateSiteConfig } from "@/lib/api/queries"
import type { SiteConfigUpdate, SiteConfigView } from "@/lib/api/schemas"
import { CIDR_ERROR_MESSAGE, MAX_KNOWN_DEVICES, normalizeCidr, validateNewCidr } from "@/lib/cidr"
import { QUARANTINE_SECONDS, TAU, parseThreshold } from "@/lib/domain"
import { formatTau } from "@/lib/format"
import { cn } from "@/lib/utils"

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  description,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  description?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium" id={`seg-${label}`}>
        {label}
      </span>
      <div role="group" aria-labelledby={`seg-${label}`} className="flex gap-2">
        {options.map((o) => (
          <Button
            key={o.value}
            type="button"
            size="sm"
            variant={o.value === value ? "default" : "outline"}
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </Button>
        ))}
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  )
}

function thresholdToText(v: number | null): string {
  return v === null ? "" : String(v).replace(".", ",")
}

function ConfigFields({ config, siteId }: { config: SiteConfigView; siteId: number }) {
  const update = useUpdateSiteConfig(siteId)
  const [informative, setInformative] = React.useState(config.informative_only_mode)
  const [active, setActive] = React.useState(config.active_response_enabled)
  const [thresholdText, setThresholdText] = React.useState(thresholdToText(config.custom_mse_threshold))
  const [devices, setDevices] = React.useState(config.known_devices)
  const [newCidr, setNewCidr] = React.useState("")
  const [cidrError, setCidrError] = React.useState<string | null>(null)
  const [saveError, setSaveError] = React.useState<string | null>(null)

  const threshold = parseThreshold(thresholdText)
  const thresholdInvalid = threshold === undefined

  const diff: SiteConfigUpdate = {}
  if (informative !== config.informative_only_mode) diff.informative_only_mode = informative
  if (active !== config.active_response_enabled) diff.active_response_enabled = active
  if (threshold !== undefined && threshold !== config.custom_mse_threshold) diff.custom_mse_threshold = threshold
  if (devices.join("\n") !== config.known_devices.join("\n")) diff.known_devices = devices
  const dirty = Object.keys(diff).length > 0

  function addCidr() {
    const err = validateNewCidr(newCidr, devices)
    if (err) return setCidrError(CIDR_ERROR_MESSAGE[err])
    setDevices([...devices, normalizeCidr(newCidr)!])
    setNewCidr("")
    setCidrError(null)
  }

  function reset() {
    setInformative(config.informative_only_mode)
    setActive(config.active_response_enabled)
    setThresholdText(thresholdToText(config.custom_mse_threshold))
    setDevices(config.known_devices)
    setNewCidr("")
    setCidrError(null)
    setSaveError(null)
  }

  function save() {
    setSaveError(null)
    update.mutate(diff, {
      onSuccess: () => toast.success("Configuración guardada."),
      onError: (e) => {
        const msg = e instanceof ApiError ? e.detail : "No se pudo guardar la configuración."
        setSaveError(msg)
      },
    })
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Operación</CardTitle>
          <CardDescription>Cómo reacciona el motor ante una anomalía en este sitio</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Segmented
            label="Modo de operación"
            value={informative ? "informative" : "active"}
            onChange={(v) => setInformative(v === "informative")}
            options={[
              { value: "informative", label: "Informativo" },
              { value: "active", label: "Activo" },
            ]}
            description="En modo informativo el motor detecta y registra, pero no bloquea nada."
          />
          <Segmented
            label="Respuesta activa"
            value={active ? "on" : "off"}
            onChange={(v) => setActive(v === "on")}
            options={[
              { value: "on", label: "Habilitada" },
              { value: "off", label: "Deshabilitada" },
            ]}
            description={
              active && informative
                ? "Habilitada, pero el modo informativo impide bloquear: pasá a modo Activo para aplicar cuarentenas."
                : "Cuando está habilitada y el modo es Activo, las anomalías graves disparan una cuarentena con iptables."
            }
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="threshold">Umbral de anomalía (MSE)</Label>
            <Input
              id="threshold"
              inputMode="decimal"
              value={thresholdText}
              onChange={(e) => setThresholdText(e.target.value)}
              placeholder={`${formatTau(TAU)} (τ global)`}
              aria-invalid={thresholdInvalid || undefined}
              aria-describedby="threshold-help"
              className="max-w-xs font-mono"
            />
            <p
              id="threshold-help"
              className={cn("text-xs", thresholdInvalid ? "text-critical-foreground" : "text-muted-foreground")}
            >
              {thresholdInvalid
                ? "Tiene que ser un número mayor que 0."
                : "Vacío usa τ global (P99 del error benigno). Un valor más alto detecta menos; uno más bajo, más."}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="quarantine">Duración de la cuarentena</Label>
            <Input id="quarantine" value={`${QUARANTINE_SECONDS} s`} readOnly disabled className="max-w-24 font-mono" />
            <p className="text-xs text-muted-foreground">Fija en el backend; solo lectura.</p>
          </div>

          <PendingFeature
            title="Suspender respuesta activa si el enlace está degradado"
            note="Hoy el backend siempre suspende la respuesta con el enlace degradado; todavía no es configurable."
          >
            <div className="flex gap-2">
              <Button size="sm">Sí</Button>
              <Button size="sm" variant="outline">
                No
              </Button>
            </div>
          </PendingFeature>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Inventario de dispositivos</CardTitle>
            <CardDescription>
              Direcciones y subredes conocidas (CIDR). Un origen privado fuera de estos rangos genera una alerta de
              dispositivo no reconocido.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form
              className="flex items-start gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                addCidr()
              }}
            >
              <div className="flex flex-1 flex-col gap-1">
                <Input
                  value={newCidr}
                  onChange={(e) => {
                    setNewCidr(e.target.value)
                    setCidrError(null)
                  }}
                  placeholder="192.168.2.0/27"
                  aria-label="Nuevo rango CIDR"
                  aria-invalid={cidrError ? true : undefined}
                  className="font-mono"
                />
                {cidrError && (
                  <p role="alert" className="text-xs text-critical-foreground">
                    {cidrError}
                  </p>
                )}
              </div>
              <Button type="submit" variant="outline" disabled={newCidr.trim() === ""}>
                <Plus data-icon="inline-start" />
                Agregar
              </Button>
            </form>

            {devices.length === 0 ? (
              <p className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                El inventario está vacío: todo origen privado se va a marcar como no reconocido.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                {devices.map((cidr) => (
                  <li key={cidr} className="flex items-center justify-between gap-2 px-3 py-1.5">
                    <span className="font-mono text-sm">{cidr}</span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Quitar ${cidr}`}
                      onClick={() => setDevices(devices.filter((d) => d !== cidr))}
                    >
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              {devices.length} de {MAX_KNOWN_DEVICES} rangos
            </p>
            <PendingFeature note="Descripción por rango (ej. “Controlador fiscal”): el backend guarda solo el CIDR." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Destinatarios por severidad
              <Badge variant="outline" className="border-medium/30 bg-medium/12 text-medium-foreground">
                pendiente
              </Badge>
            </CardTitle>
            <CardDescription>RF-08: ruteo de notificaciones por sitio. Todavía no existe en el backend.</CardDescription>
          </CardHeader>
          <CardContent>
            <PendingFeature>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 font-medium">Severidad</th>
                    <th className="py-1 font-medium">Notificar a</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1">Crítica</td>
                    <td className="py-1">—</td>
                  </tr>
                  <tr>
                    <td className="py-1">Alta</td>
                    <td className="py-1">—</td>
                  </tr>
                  <tr>
                    <td className="py-1">Advertencia</td>
                    <td className="py-1">—</td>
                  </tr>
                </tbody>
              </table>
            </PendingFeature>
          </CardContent>
          <CardFooter className="flex flex-col items-stretch gap-3">
            {saveError && (
              <p role="alert" className="rounded-md border border-critical/30 bg-critical/8 p-2 text-sm text-critical-foreground">
                {saveError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset} disabled={!dirty || update.isPending}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={!dirty || thresholdInvalid || update.isPending}>
                {update.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

export function SiteConfigForm({ siteId }: { siteId: number }) {
  const query = useSiteConfig(siteId)
  return (
    <QueryState query={query}>
      {/* `key` reinicia el borrador cuando la config del servidor cambia (después de guardar). */}
      {query.data && <ConfigFields key={JSON.stringify(query.data)} config={query.data} siteId={siteId} />}
    </QueryState>
  )
}
