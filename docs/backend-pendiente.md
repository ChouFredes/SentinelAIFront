# Backend pendiente (lista para Facundo)

El front no modifica el backend: lo que falta se mockea en el BFF (`lib/api/mocks/`) y se registra acá.
Los esquemas propuestos viven en `lib/api/schemas.ts` (sección "Propuesto"); si el contrato cambia, se actualiza ahí primero.

Hasta que cada endpoint exista, `lib/server/backend-support.ts` lo marca en `false` y el BFF responde con el mock **aunque `SENTINEL_USE_MOCKS=false`**. Al implementarse, basta con pasarlo a `true`.

## Imprescindibles

| # | Endpoint | Respuesta propuesta | Lo usan |
|---|---|---|---|
| 1 | `GET /sites` | `SiteView[]`: `{ id, slug, name, is_active, config: SiteConfigView }` | selector de sitio global, Sitios |
| 2 | `GET /sites/{site_id}/sensors` | `SiteSensorView[]`: `SensorTelemetryView` + `name` | Resumen, Sitios, Datos transmitidos |
| 3 | `GET /mitigation-events?site_id=&source_ip=&limit=` | `MitigationEvent[]`, más reciente primero | Detalle de alerta, Auditoría |
| 4 | `GET /quarantines?site_id=` | `AdminQuarantineView[]`: `QuarantineView` + `site_id` (versión admin de `/dashboard/state`, que solo acepta token de sensor) | Resumen, Alertas (botón Revertir) |

## Recomendados

| # | Endpoint | Respuesta propuesta | Hoy en el BFF |
|---|---|---|---|
| 5 | `GET /alerts` con `since`, `until`, `unrecognized_device=true`, `before_id` | `AlertsPage`: `{ items: AlertView[], next_before_id: number \| null }` | Pide `limit=1000` y filtra/pagina en `lib/server/alerts.ts` (se pierde lo que supere las 1000 alertas más recientes) |
| 6 | `GET /sites/{site_id}/summary?hours=24` | `SiteSummary`: `total_alerts`, `by_severity`, `by_hour[]`, `top_sources[]`, `flows_analyzed` | Se calcula en `lib/server/summary.ts` a partir de `/alerts` y la telemetría |
| 7 | `GET /sensors/{sensor_id}/flows?limit=20` | `FlowSample[]`: `{ source_ip, destination_ip, destination_port, features }` (RF-06) | Siempre mock |
| 8 | `GET /alerts/{alert_id}` | `AlertView` | Busca la alerta en `/alerts?limit=1000` |

## Cosas de los wireframes que el backend no soporta

El front las dibuja **deshabilitadas con badge "pendiente"** (`components/pending-feature.tsx`); no simula ninguna escritura.

- **Marcar falso positivo** (wf2): no hay modelo ni endpoint.
- **Características con mayor error de reconstrucción** (wf2): `AlertView` no trae el error por feature.
- **Descripción por CIDR** en el inventario (wf3, wf5): `known_devices` es `string[]` sin metadatos.
- **Nombre y estado de dispositivo** Nuevo / Aprobado / Sospechoso (wf5): no existe entidad "dispositivo".
- **Suspender respuesta activa si el enlace está degradado** (wf3): el backend lo hace siempre; no hay flag configurable.
- **Duración de la cuarentena** (wf3): fija en 60 s, solo lectura.
- **"Guardar versión"** (wf3): no hay versionado de configuración; se guarda con `PUT /sites/{id}/config`.
- **Destinatarios de notificaciones por severidad** (RF-08, wf3): sin definir en el backend.
- **Estado de la alerta** (wf1: "Cuarentena activa", "Revertida (manual)", "Suspendida: enlace degradado"): no es un campo; el front lo deriva de los flags de `AlertView`, las cuarentenas activas y `mitigation_events` (`lib/domain.ts → deriveAlertState`).

## Severidades

El backend tiene tres (`warning`, `high`, `critical`); el panel las muestra como Advertencia / Alta / Crítica. Los wireframes dibujan cuatro (Media/Baja); no se inventa un nivel que el backend no emite.

## Despliegue

Si el front corre en Vercel, el FastAPI tiene que ser alcanzable desde internet (VPS o un túnel tipo Cloudflare Tunnel). Hay que coordinar la URL pública (`SENTINEL_API_URL`) y el token admin (`SENTINEL_ADMIN_TOKEN`, 32–512 caracteres; el backend guarda su SHA-256).
