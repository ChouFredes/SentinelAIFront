# SentinelAI — Frontend (panel de administración)

Panel web de SentinelAI: IDS con autoencoder que detecta flujos anómalos, aplica cuarentenas con iptables y registra todo para auditoría. Este repo es **solo el front**. El backend (FastAPI) vive en otro repo y lo mantiene Facundo: **no se modifica desde acá**. Lo que falte del backend se mockea y se anota en `docs/backend-pendiente.md`.

Autores del front: Augusto (y Claude). Proyecto final de ingeniería (PFI); la entrega se defiende mostrando el panel desplegado con un link.

## Stack

- Next.js (App Router) + TypeScript estricto
- Tailwind + shadcn/ui (reutilizar lo visual del prototipo de v0 si sirve; no mezclar con otra librería de componentes)
- TanStack Query para datos del servidor, Zod para validar respuestas
- Deploy: Vercel

## Arquitectura

- **BFF**: el navegador nunca habla con FastAPI. Route handlers de Next (`app/api/...`) hacen de proxy y agregan `Authorization: Bearer ${SENTINEL_ADMIN_TOKEN}` del lado servidor. Así no hace falta CORS en el backend y el token no llega al browser.
- **Login**: el backend no tiene usuarios. Login simple con contraseña de panel (`PANEL_PASSWORD`) → cookie httpOnly firmada (`SESSION_SECRET`). Middleware protege `/(dashboard)` y `/api`.
- **Mocks**: `SENTINEL_USE_MOCKS=true` hace que el BFF devuelva datos tipados de `lib/api/mocks/` en vez de llamar al backend. Cada endpoint que todavía no existe en el backend usa mock siempre hasta que Facundo lo implemente.
- **Esquemas**: `lib/api/schemas.ts` replica los modelos Pydantic de abajo. Si el backend cambia, se actualiza acá primero.

Variables de entorno (`.env.local`, y en Vercel):

```
SENTINEL_API_URL=https://...        # URL pública del FastAPI
SENTINEL_ADMIN_TOKEN=...            # token admin en claro (el backend guarda su SHA-256 en SENTINEL_ADMIN_TOKEN_SHA256); 32–512 chars
PANEL_PASSWORD=...
SESSION_SECRET=...
SENTINEL_USE_MOCKS=true
```

Nota de deploy: si el front está en Vercel, el FastAPI tiene que ser alcanzable desde internet (VPS, o un túnel tipo Cloudflare Tunnel desde la máquina donde corre). Coordinar con Facundo.

## API existente (backend, rama 75)

Auth: Bearer. El token admin puede leer todo y es el único que puede escribir. Un token de sensor solo lee su propio sitio.

| Método | Ruta | Notas |
|---|---|---|
| GET | `/health` | `HealthResponse`, sin auth |
| GET | `/alerts` | query: `site_id`, `sensor_id`, `source_ip` (IP completa, si no 422), `severity`, `since` (inclusivo), `until` (exclusivo; since < until, si no 422; sin offset = UTC), `unrecognized_device`, `before_id` (solo ids menores, para paginar hacia atrás), `limit` (1–1000, def. 100). Orden: más reciente primero. → `AlertView[]` |
| GET | `/alerts/{alert_id}` | 404 si no existe → `AlertView` |
| GET | `/sites` | → `SiteView[]` (id, slug, name, is_active, config) |
| GET | `/sites/{site_id}/sensors` | 404 si el sitio no existe → `SiteSensorView[]` (telemetría + `name`) |
| GET | `/mitigation-events` | query: `site_id`, `source_ip` (IP completa), `limit` (1–1000, def. 100). Más reciente primero, sin paginación → `MitigationEvent[]` |
| GET | `/quarantines` | query: `site_id`. Cuarentenas vivas (versión admin de `/dashboard/state`) → `AdminQuarantineView[]` |
| GET | `/sensors/{sensor_id}/telemetry` | → `SensorTelemetryView` |
| GET | `/sites/{site_id}/config` | → `SiteConfigView` |
| PUT | `/sites/{site_id}/config` | admin. Body parcial `SiteConfigUpdate`. 422 si body vacío o si un bool/lista viene `null` |
| POST | `/quarantines/{source_ip}/revert?site_id=` | admin. 404 sin cuarentena activa; 409 si la IP está en varios sitios (pasar `site_id`) o el estado cambió; 503 firewall/DB → `ManualReversionResponse` |
| GET | `/dashboard/state` | **solo token de sensor** (no sirve con admin) → `DashboardState` |
| POST | `/ingest`, `/sensors/{id}/heartbeat` | los usa el sensor, no el panel |

Modelos (replicar en Zod; fechas ISO 8601 UTC):

```
AlertView { id, site_id, sensor_id: int; source_ip, destination_ip: str; destination_port: int;
  mse_score: float; severity: "warning"|"high"|"critical"; anomaly, unrecognized_device,
  link_degraded, informative_only_mode, mitigation_applied: bool; occurred_at: datetime }
SensorTelemetryView { sensor_id, site_id: int; is_active: bool; last_heartbeat_at, last_ingest_at: datetime|null;
  flow_count: int; last_link_degraded: bool; last_link_report_at: datetime|null }
SiteConfigView { site_id: int; custom_mse_threshold: float|null; active_response_enabled: bool;
  informative_only_mode: bool; known_devices: string[] }   # known_devices = CIDRs, máx 512
SiteConfigUpdate { custom_mse_threshold?: float>0|null; active_response_enabled?: bool;
  informative_only_mode?: bool; known_devices?: string[] }
ManualReversionResponse { site_id: int; source_ip: str; reverted: bool; rule_was_present: bool }
QuarantineView { source_ip, destination_ip: str; destination_port: int; mse_score: float; quarantined_at, expires_at: datetime }
CriticalAlertView { source_ip, destination_ip: str; destination_port: int; mse_score: float; first_seen, last_seen, expires_at: datetime }
DashboardState { active_quarantines: QuarantineView[]; critical_alerts: CriticalAlertView[] }
HealthResponse { status: str; ml_ready, database_ready_at_startup, logging_ready: bool }
SiteView { id: int; slug, name: str; is_active: bool; config: SiteConfigView }
SiteSensorView = SensorTelemetryView + { name: str }
AdminQuarantineView = QuarantineView + { site_id: int }
MitigationEvent { id, site_id: int; sensor_id: int|null;
  event_type: "APPLY"|"REVERSION"|"MANUAL_REVERSION"; original_event_id: int|null;
  source_ip: str; destination_ip: str|null; destination_port: int|null; mse_score: float|null;   # nulos en reglas importadas
  reason: str|null;   # texto libre; conocidos: quarantine_timer_elapsed, administrator_manual_reversion, legacy_quarantine_import
  occurred_at }
```

Dominio útil para la UI: τ (umbral MSE global) = 0.000308; anomalía = MSE > umbral del sitio (o τ); severidad critical cuando MSE ≥ max(3τ, 3 × umbral del sitio), high si es anomalía y warning si no (alerta solo por dispositivo no reconocido o enlace degradado); cuarentena por defecto 60 s; `mitigation_events` es append-only (cada REVERSION apunta a su APPLY por `original_event_id`). Modo informativo = detecta pero no bloquea.

## Faltante en backend (mockear; lista para Facundo)

Solo quedan tres cosas (detalle en `docs/backend-pendiente.md`):
1. `GET /sensors/{sensor_id}/flows?limit=20` → últimos flujos desde los logs de tráfico (RF-06). Hoy la muestra es mock y la pantalla la marca "pendiente" en modo real.
2. `GET /sites/{site_id}/summary?hours=24` → totales, alertas por hora, por severidad, top orígenes. Hoy el BFF lo calcula desde `/alerts` (con `since` y paginación por `before_id`) y los sensores del sitio.
3. Destinatarios de notificaciones (RF-08): no existe en el backend.

## Pantallas (wireframes en `docs/wireframes/`)

Sidebar: Resumen, Alertas, Sitios, Dispositivos, Datos transmitidos, Auditoría, Configuración. Selector de sitio global.

Prioridad:
1. **Alertas** (`wf1`): tabla con filtros (sitio, severidad, IP, rango), badge de severidad, flags (dispositivo no reconocido, enlace degradado, modo informativo, mitigado) y botón **Revertir** si hay cuarentena activa. Confirmar antes de revertir; manejar 404/409/503 con mensajes claros.
2. **Detalle de alerta** (`wf2`): datos del flujo + historial de mitigación APPLY → REVERSION/MANUAL_REVERSION.
3. **Configuración del sitio** (`wf3`): modo informativo, respuesta activa, umbral MSE (vacío = τ global), duración de cuarentena (solo lectura, 60 s), inventario CIDR con validación, destinatarios RF-08 marcado "pendiente".
4. **Resumen**: KPIs del sitio, cuarentenas activas con cuenta regresiva, alertas críticas, estado de sensores y `/health`.
5. **Datos transmitidos** (`wf4`, RF-06): qué features envía el sensor (muestra JSON).
6. **Dispositivos no reconocidos** (`wf5`, RF-09): alertas con `unrecognized_device=true` agrupadas por IP, con acción "agregar al inventario" (PUT config).

## Convenciones

- Interfaz en español rioplatense; código e identificadores en inglés.
- Fechas mostradas en America/Argentina/Buenos_Aires.
- Todo fetch pasa por `lib/api/client.ts` y se valida con Zod.
- No commitear `.env*`. No tocar el repo del backend.
