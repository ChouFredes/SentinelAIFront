# Backend: integrado y pendiente

El front no modifica el backend (`justicepaladin/SentinelAI`, rama 75). Lo que falta se mockea en el BFF (`lib/api/mocks/`) y se registra acá.
Los esquemas viven en `lib/api/schemas.ts`; si el contrato cambia, se actualiza ahí primero.

`lib/server/backend-support.ts` marca qué endpoints existen. Los que están en `false` responden con mock **aunque `SENTINEL_USE_MOCKS=false`**; al implementarse, basta pasarlos a `true`.

## Ya integrado

| Endpoint | Cómo lo usa el panel |
|---|---|
| `GET /sites` | selector de sitio global, Sitios, Dispositivos, Resumen |
| `GET /sites/{id}/sensors` | estado de sensores (Resumen, Sitios, Datos transmitidos) y suma de `flow_count` del resumen |
| `GET /mitigation-events` | Auditoría e historial del detalle de alerta |
| `GET /quarantines` | cuarentenas activas, botón Revertir |
| `GET /alerts/{id}` | detalle de alerta |
| `GET /alerts` con `since`, `until`, `unrecognized_device`, `before_id`, `limit` | listado, paginación, Dispositivos y resumen |

Notas de contrato que el panel respeta:

- `GET /alerts`: `since` inclusivo, `until` exclusivo (`since < until`, si no 422); las fechas sin offset se toman como UTC. `before_id` devuelve solo ids menores. El backend no informa el total: si vienen exactamente `limit` filas el panel asume que hay más y usa el id de la última como cursor.
- `source_ip` (en `/alerts` y `/mitigation-events`) tiene que ser una IP completa; con texto parcial el backend responde 422. El BFF lo valida antes de llamar y la interfaz solo manda la IP cuando está completa.
- `GET /mitigation-events` no pagina (máximo 1000, más reciente primero). `destination_ip`, `destination_port` y `mse_score` pueden ser `null` (reglas importadas) y `reason` es texto libre: los conocidos tienen etiqueta, el resto se muestra tal cual.
- Los `datetime` se serializan sin zona; el esquema Zod los normaliza a UTC (`lib/iso.ts`).
- Con el backend real, `GET /mitigation-events` tiene que devolver eventos de todos los sitios para el token admin: una alerta puede estar bloqueada por la cuarentena de otro sitio (la regla de iptables es global).

## Pendiente

| Endpoint | Detalle | Hoy en el BFF |
|---|---|---|
| `GET /sensors/{sensor_id}/flows?limit=20` | `FlowSample[]`: `{ source_ip, destination_ip, destination_port, features }` (RF-06) | Siempre mock; en modo real Datos transmitidos envuelve la muestra en "pendiente" |
| `GET /sites/{site_id}/summary?hours=24` | `SiteSummary`: `total_alerts`, `by_severity`, `by_hour[]`, `top_sources[]`, `flows_analyzed` | Se calcula en `lib/server/summary.ts` con las alertas del período (desde `since`, paginadas por `before_id`, tope de 5000 filas) y la suma de `flow_count` de los sensores |
| Destinatarios de notificaciones por severidad (RF-08) | Sin definir | Se dibuja deshabilitado |

## Cosas de los wireframes que el backend no soporta

El front las dibuja **deshabilitadas con badge "pendiente"** (`components/pending-feature.tsx`); no simula ninguna escritura.

- **Marcar falso positivo** (wf2): no hay modelo ni endpoint.
- **Características con mayor error de reconstrucción** (wf2): `AlertView` no trae el error por feature.
- **Descripción por CIDR** en el inventario (wf3, wf5): `known_devices` es `string[]` sin metadatos.
- **Nombre y estado de dispositivo** Nuevo / Aprobado / Sospechoso (wf5): no existe entidad "dispositivo".
- **Suspender respuesta activa si el enlace está degradado** (wf3): el backend lo hace siempre; no hay flag configurable.
- **Volumen transmitido por hora** (wf4): solo existe `flow_count` total en la telemetría del sensor.
- **Duración de la cuarentena** (wf3): fija en 60 s, solo lectura.
- **"Guardar versión"** (wf3): no hay versionado de configuración; se guarda con `PUT /sites/{id}/config`.
- **Destinatarios de notificaciones por severidad** (RF-08, wf3): sin definir en el backend.
- **Estado de la alerta** (wf1: "Cuarentena activa", "Revertida (manual)", "Suspendida: enlace degradado"): no es un campo; el front lo deriva de los flags de `AlertView`, las cuarentenas activas y `mitigation_events` (`lib/domain.ts → deriveAlertState`).

## Severidades y mitigación (semántica de `/ingest`, rama 75)

El backend tiene tres severidades (`warning`, `high`, `critical`); el panel las muestra como Advertencia / Alta / Crítica. Los wireframes dibujan cuatro (Media/Baja); no se inventa un nivel que el backend no emite.

- `anomaly = mse > umbral del sitio` (`custom_mse_threshold` o τ).
- `critical` si `mse ≥ max(3τ, 3 × umbral del sitio)`; `high` si es anomalía no crítica; `warning` si **no** es anomalía y la alerta existe solo por `unrecognized_device` o `link_degraded`.
- Hay respuesta activa solo ante anomalía, con `active_response_enabled` y sin modo informativo ni enlace degradado. Se aíslan también las IP privadas; solo se excluyen IPv6, loopback, no especificada, multicast y link-local.
- La regla de iptables es global (por IP, no por sitio). Si la IP ya estaba aislada, la alerta queda con `mitigation_applied=true` **sin** APPLY nuevo, aunque la cuarentena la haya abierto otro sitio. El panel la muestra como "Bloqueada (cuarentena previa)" (cuarentena del mismo sitio) o "Bloqueada (cuarentena de otro sitio)", sin botón Revertir: la cuarentena se revierte desde la alerta que la originó.

## Despliegue

Si el front corre en Vercel, el FastAPI tiene que ser alcanzable desde internet (VPS o un túnel tipo Cloudflare Tunnel). Hay que coordinar la URL pública (`SENTINEL_API_URL`) y el token admin (`SENTINEL_ADMIN_TOKEN`, 32–512 caracteres; el backend guarda su SHA-256).
