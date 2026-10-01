# FirmaDigital

Landing page para la solicitud de emisión de firmas digitales y certificados electrónicos, construida con **Next.js 16**, **TypeScript** y **Tailwind CSS v4**. El formulario de contacto guarda la solicitud en una base de datos **SQLite** y avisa por correo mediante **Nodemailer** (SMTP). Las solicitudes se gestionan desde un panel privado en `/admin`.

## Requisitos

- Node.js 20.9+
- pnpm (Package Manager)

## Puesta en marcha

Instala las dependencias:

```bash
pnpm install
```

Genera el cliente de Prisma y aplica las migraciones:

```bash
pnpm db:generate
pnpm db:migrate
```

Configura las variables de entorno copiando el ejemplo:

```bash
cp .env.example .env.local
```

Rellena `.env.local`:

| Variable                | Descripción                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| `SMTP_HOST`             | Host del servidor SMTP (ej. `smtp.gmail.com`)                     |
| `SMTP_PORT`             | Puerto SMTP (`587` TLS, `465` SSL)                                |
| `SMTP_USER`             | Usuario del servidor SMTP                                         |
| `SMTP_PASS`             | Contraseña (en Gmail, usa una "contraseña de aplicación")          |
| `SMTP_FROM`             | Remitente de los correos                                          |
| `CONTACT_EMAIL`         | Destinatario de las solicitudes de firma digital                  |
| `DATABASE_URL`          | Ruta del fichero SQLite (por defecto `file:./data/app.db`)         |
| `ADMIN_EMAIL`           | Correo del administrador del panel                                 |
| `ADMIN_PASSWORD`        | Contraseña del administrador (larga y única)                       |
| `ADMIN_SESSION_SECRET`  | Secreto de firma de la sesión (`openssl rand -base64 32`)         |

Genera el secreto de sesión con:

```bash
openssl rand -base64 32
```

> Si falta alguna variable SMTP, la solicitud **se guarda igualmente** y el panel muestra el aviso de que el correo no se envió. Si faltan `ADMIN_*`, el panel no permite el acceso.

Arranca el servidor de desarrollo:

```bash
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000). El formulario está en `/#contacto` y el panel en [http://localhost:3000/admin](http://localhost:3000/admin).

## Scripts

| Comando             | Descripción                                          |
| ------------------- | ---------------------------------------------------- |
| `pnpm dev`          | Servidor de desarrollo (Turbopack)                   |
| `pnpm build`        | Build de producción                                  |
| `pnpm start`        | Sirve el build de producción                         |
| `pnpm lint`         | ESLint                                               |
| `pnpm typecheck`    | Comprobación de tipos con `tsc --noEmit`             |
| `pnpm db:generate`  | Regenera el cliente de Prisma en `lib/generated`     |
| `pnpm db:migrate`   | Crea/aplica migraciones en desarrollo                |
| `pnpm db:deploy`    | Aplica migraciones en producción (sin prompts)       |
| `pnpm db:studio`    | GUI de Prisma para inspeccionar la base de datos     |

## Estructura

```
app/
  actions/request-signature.ts   Server Action: valida, guarda y avisa por correo
  admin/
    actions.ts                   Server Actions: login/logout, estado, notas
    layout.tsx                   Marco del panel (navegación y cierre de sesión)
    login/page.tsx               Inicio de sesión
    page.tsx                     Listado con filtros, métricas y paginación
    requests/[id]/page.tsx       Ficha, cambio de estado, notas e historial
  api/admin/export/route.ts      Exportación CSV protegida
components/
  contact-form.tsx               Formulario de solicitud ('use client')
  admin/                         Login, filtros, tabla, métricas, badges, timeline
data/
  admin-config.ts                ÚNICO sitio que lee ADMIN_EMAIL/PASSWORD/SECRET
  auth.ts                        DAL de sesión (lee la cookie y exige sesión)
  db.ts                          ÚNICO sitio que instancia Prisma
  requests.ts                    DAL de solicitudes (consultas y mutaciones)
lib/
  auth.ts                        HMAC, comparación en tiempo constante (puro)
  csv.ts                         Escape RFC 4180, BOM y antiformulas
  request-status.ts              Estados y transiciones permitidas
  validation.ts                  Esquemas zod compartidos
  email.ts                       Transporte Nodemailer y render del mensaje
prisma/
  schema.prisma                  Modelos SignatureRequest y RequestStatusEvent
  migrations/                    Migraciones SQL versionadas
proxy.ts                         Redirección de navegación de /admin
```

## Flujo del formulario

1. El usuario rellena el formulario (datos personales, empresa, verificación de identidad, tipo de certificado y consentimiento RGPD).
2. El cliente valida con HTML nativo y envía mediante una Server Action.
3. El servidor valida el payload con **zod** y devuelve errores por campo si procede.
4. Si es válido, la solicitud **se guarda en SQLite** (es la fuente de verdad).
5. A continuación **Nodemailer** envía el aviso a `CONTACT_EMAIL`. Si el envío falla, la solicitud no se pierde: se registra el error y la ficha del panel lo muestra.
6. La UI muestra un mensaje de éxito en ambos casos.

## Panel de administración

- Ruta: `/admin`. Credenciales mediante `ADMIN_EMAIL` y `ADMIN_PASSWORD` (una única credencial compartida en esta versión).
- La sesión es una cookie firmada con HMAC-SHA256 (`fd_admin_session`, `HttpOnly`, `SameSite=Lax`, `Secure` en producción) válida 8 horas.
- `proxy.ts` solo redirige la navegación. La autorización real la aplica el DAL: cada Server Action y el endpoint de CSV revalidan la sesión por sí mismos.
- Funciones: listado con búsqueda y filtros (estado, tipo de certificado), métricas, detalle de la solicitud, cambio de estado con historial, notas internas y exportación CSV.
- Estados: `NEW` → `IN_REVIEW` / `REJECTED`, `IN_REVIEW` → `ACCEPTED` / `REJECTED`, y `ACCEPTED` / `REJECTED` → `IN_REVIEW`. Cada transición queda registrada en el historial y no se puede deshacer saltándose la máquina de estados.
- La exportación CSV (`/api/admin/export`) respeta los mismos filtros que el listado e incluye un BOM UTF-8 para abrirlo directamente en Excel.

## Despliegue

- Tras clonar o actualizar, ejecuta `pnpm db:generate` y `pnpm db:deploy` antes de `pnpm build`.
- SQLite es un fichero: **una sola instancia de la aplicación** puede escribir sobre `data/app.db`. Con varias réplicas o varias instancias de Node, las escrituras concurrentes pueden fallar con `database is locked`.
- Para escalar, sustituye `DATABASE_URL` por un servidor de base de datos y cambia el datasource del esquema.

## Datos personales y copias de seguridad

`data/app.db` contiene datos personales (nombre, email, teléfono, NIF, dirección y documento de identidad) sujetos al RGPD. Está en `.gitignore` y **no debe subirse a ningún repositorio**.

Copia de seguridad:

```bash
cp data/app.db "copias/app-$(date +%F).db"
```

El backup debe hacerse con la aplicación parada, o usando el modo WAL de SQLite, para no copiar un fichero a medias. Restauro: para volver al estado anterior, para la aplicación y sustituye `data/app.db` por la copia.

Borrado de datos: para eliminar una solicitud y su historial hay que borrarla en la base de datos (por ejemplo con `pnpm db:studio`); la interfaz no ofrece borrado porque el historial es de solo adición.
