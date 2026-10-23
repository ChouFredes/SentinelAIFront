# SentinelAI — panel de administración (front)

Panel web de SentinelAI: IDS con autoencoder que detecta flujos anómalos, aplica cuarentenas con iptables y registra todo para auditoría. Este repo es solo el front; el backend (FastAPI) vive en otro repo y no se modifica desde acá.

## Stack

Next.js (App Router) · TypeScript estricto · Tailwind + shadcn/ui (estilo `base-nova`) · TanStack Query · Zod · deploy en Vercel.

## Cómo corre

```bash
pnpm install
cp .env.example .env.local   # completar PANEL_PASSWORD y SESSION_SECRET
pnpm dev
```

| Variable | Para qué |
|---|---|
| `PANEL_PASSWORD` | Contraseña de acceso al panel (el backend no tiene usuarios). |
| `SESSION_SECRET` | Firma la cookie de sesión (mínimo 32 caracteres). |
| `SENTINEL_USE_MOCKS` | `true`: el BFF responde con datos simulados de `lib/api/mocks/`. |
| `SENTINEL_API_URL` | URL pública del FastAPI (solo con mocks apagados). |
| `SENTINEL_ADMIN_TOKEN` | Token admin en claro, 32–512 caracteres (el backend guarda su SHA-256). |

Con `SENTINEL_USE_MOCKS=true` alcanza con las dos primeras variables.

## Arquitectura

- **BFF**: el navegador nunca habla con FastAPI. Los route handlers de `app/api/*` hacen de proxy, agregan `Authorization: Bearer` del lado servidor y validan las respuestas con Zod (`lib/server/sentinel.ts`). El token admin no llega al navegador.
- **Login**: contraseña de panel → cookie `httpOnly` firmada con HMAC (`lib/session.ts`). `proxy.ts` protege las páginas y `/api/*` (401 JSON para la API, redirección a `/login` para las páginas).
- **Esquemas**: `lib/api/schemas.ts` replica los modelos del backend. Si el backend cambia, se actualiza ahí primero.
- **Mocks**: los endpoints que todavía no existen en el backend responden siempre con mock (`lib/server/backend-support.ts`). La lista para Facundo está en [`docs/backend-pendiente.md`](docs/backend-pendiente.md).
- **Datos en el cliente**: todo pasa por `lib/api/client.ts` y los hooks de `lib/api/queries.ts`.
- Fechas en `America/Argentina/Buenos_Aires` (`lib/format.ts`).

## Pantallas

Resumen · Alertas (con Revertir) y detalle · Sitios y configuración · Dispositivos no reconocidos · Datos transmitidos · Auditoría. Lo que está en los wireframes (`docs/wireframes/`) pero el backend no soporta se muestra deshabilitado con el aviso "pendiente".

## Scripts

```bash
pnpm typecheck   # next typegen + tsc
pnpm lint
pnpm test        # vitest
pnpm build
```

## Deploy en Vercel

1. Importar el repo y cargar las variables de arriba.
2. Para la demo con datos simulados: `SENTINEL_USE_MOCKS=true`. El estado de los mocks vive en memoria de cada instancia, así que se reinicia con los arranques en frío.
3. Para usar el backend real, el FastAPI tiene que ser alcanzable desde internet (VPS o un túnel tipo Cloudflare Tunnel): poner `SENTINEL_API_URL`, `SENTINEL_ADMIN_TOKEN` y `SENTINEL_USE_MOCKS=false`. Los endpoints pendientes siguen en mock hasta que existan.
