## Why

Hoy las solicitudes de firma digital que llegan por el formulario de la web solo existen como un correo en la bandeja de entrada. No hay registro, ni forma de saber cuántas hay, cuál es su estado de gestión, ni de consultar el histórico. Esto obliga a trabajar con el correo como única "base de datos", lo que impide cualquier seguimiento comercial y arriesga la pérdida de solicitudes.

Necesitamos un panel de administración privado donde el equipo pueda consultar, filtrar y gestionar el ciclo de vida de cada solicitud.

## What Changes

- **BREAKING** (comportamiento del formulario): la Server Action `requestSignature` pasa a **persistir** cada solicitud válida en base de datos. El envío del correo de aviso se mantiene, pero pasa a ser un efecto secundario best-effort: si el SMTP falla, la solicitud **no se pierde** y queda registrada con una marca de aviso de error.
- Se añade un esquema de base de datos con SQLite + Prisma: tablas `SignatureRequest` (datos de la solicitud + estado + notas) y `RequestStatusEvent` (historial de cambios de estado).
- Se añade autenticación de administrador por credenciales en variables de entorno (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) con cookie de sesión firmada mediante HMAC y protección de rutas en `proxy.ts` (`middleware.ts` está deprecado en Next 16).
- Se añade la sección privada `/admin` con:
  - listado paginado de solicitudes, con búsqueda por texto y filtros por estado y tipo de certificado;
  - ficha de detalle de cada solicitud con todos los datos y el historial de cambios;
  - tarjetas de métricas (totales, nuevas, en revisión, rates por tipo de certificado);
  - cambio de estado del flujo (nueva → en revisión → aceptada / rechazada);
  - notas internas por solicitud, visibles solo en el panel;
  - exportación CSV de las solicitudes filtradas.
- Se añade un endpoint CSV protegido por la misma sesión de administrador.
- Se documentan las nuevas variables de entorno en `.env.example` y `README.md`.

## Capabilities

### New Capabilities

- `signature-request-capture`: Captura y persistencia de las solicitudes enviadas desde el formulario público, incluyendo la decoupled notification por email y el registro de errores de notificación sin pérdida de datos.
- `admin-auth`: Autenticación del administrador mediante credenciales de entorno, gestión de sesión con cookie firmada y protección del árbol de rutas administrativas.
- `admin-dashboard`: Interfaz de administración: listado paginado con búsqueda y filtros, ficha de detalle, y tarjetas de métricas agregadas.
- `request-workflow`: Gestión del ciclo de vida de la solicitud: máquina de estados, registro histórico de transiciones y notas internas.
- `request-export`: Exportación de las solicitudes a formato CSV respetando los filtros activos y la autorización de administrador.

### Modified Capabilities

Ninguna. `openspec/specs/` está vacío, por lo que no existen requisitos previos que modificar.

## Impact

**Código existente**

- `app/actions/request-signature.ts` — deja de ser el único consumidor de `RequestPayload`: persiste y notifica.
- `lib/validation.ts` — se reutiliza tal cual como origen de la forma del payload; se derivan los enums de la BD desde sus arrays.
- `lib/email.ts` — se reutiliza; se añade la posibilidad de notificar a un destinario concreto y de no romper el flujo de captura.
- `components/contact-form.tsx` — sin cambios de UI previstos (el contrato de la Server Action se mantiene).
- `components/site-header.tsx` — posible enlace discreto al panel, no requerido para la funcionalidad.

**Código nuevo**

- `prisma/schema.prisma`, `prisma.config.ts`
- `data/db.ts` (instancia Prisma singleton), `data/admin-config.ts` (única lectura de secretos de admin), `data/requests.ts` (queries y agregaciones), `data/auth.ts` (DAL de sesión)
- `lib/auth.ts` (HMAC, verify/timing-safe, puro), `lib/csv.ts`, `lib/request-status.ts` (máquina de estados)
- `app/admin/layout.tsx`, `app/admin/page.tsx`, `app/admin/login/page.tsx`, `app/admin/requests/[id]/page.tsx`
- `app/admin/actions.ts` (login/logout, cambio de estado, alta de notas)
- `app/api/admin/export/route.ts`
- `components/admin/*` (tabla, filtros, métricas, badges de estado, timeline)
- `proxy.ts`

**Dependencias**

- Nuevas: `@prisma/client`, `prisma` (dev). SQLite como motor, sin servidor externo.
- El stack existente (Next 16 App Router, React 19, Tailwind v4, zod 4) se mantiene intacto.

**Sistemas y configuración**

- Nuevo fichero `data/app.db` (SQLite) en `.gitignore`, creado por `prisma migrate dev` / `prisma db push`.
- Nuevas variables `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` documentadas en `.env.example`.
- Sin despliegue de infraestructura nueva: SQLite es un fichero local.
