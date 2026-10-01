# FirmaDigital

Landing page para la solicitud de emisión de firmas digitales y certificados electrónicos, construida con **Next.js 16**, **TypeScript** y **Tailwind CSS v4**. El formulario de contacto guarda la solicitud en una base de datos **SQLite** (en local) o **Turso** (en staging y producción) y avisa por correo mediante **Nodemailer** (SMTP). Las solicitudes se gestionan desde un panel privado en `/admin`.

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
| `TURSO_DATABASE_URL`   | URL de Turso (`libsql://...`). Alternativa a `DATABASE_URL`         |
| `TURSO_AUTH_TOKEN`     | Token de Turso (lectura y escritura)                                 |
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
| `pnpm db:migrate`   | Crea/aplica migraciones en desarrollo (solo local)  |
| `pnpm db:deploy`    | Aplica migraciones en local, sin prompts             |
| `pnpm db:deploy:turso` | Aplica el esquema en Turso, sin prompts           |
| `pnpm db:studio`    | GUI de Prisma para inspeccionar la base de datos     |

`db:migrate` espera siempre la base de datos local: es el único comando que genera SQL de migración nuevo. Para desplegar el esquema en Turso usa `db:deploy:turso`, no `db:deploy` (ver la sección de Turso para el porqué).

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
  db-config.ts                   Lee DATABASE_URL/TURSO_* del entorno
  db.ts                          ÚNICO sitio que instancia Prisma
  requests.ts                    DAL de solicitudes (consultas y mutaciones)
lib/
  auth.ts                        HMAC, comparación en tiempo constante (puro)
  csv.ts                         Escape RFC 4180, BOM y antiformulas
  db-config.ts                   Resolución y validación de la URL de la BD (puro)
  request-status.ts              Estados y transiciones permitidas
  validation.ts                  Esquemas zod compartidos
  email.ts                       Transporte Nodemailer y render del mensaje
prisma/
  schema.prisma                  Modelos SignatureRequest y RequestStatusEvent
  migrations/                    Migraciones SQL versionadas
prisma.config.ts                 Configuración del CLI de Prisma (comparte lib/db-config.ts)
scripts/
  check-db-config.ts             Comprobación de la resolución de la URL
  check-local-db.ts              Escritura/lectura real contra SQLite local
  check-turso-db.ts              Escritura/lectura real contra Turso
  check-turso-state.ts           Tablas e índices existentes en Turso
  db-turso-migrate.ts            Aplica el esquema en Turso (db:deploy:turso)
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

## Base de datos: SQLite local o Turso

La aplicación escribe en **uno** de estos dos destinos, y la elección es explícita:

| Destino            | Cuándo                    | Variables                                  |
| ------------------ | ------------------------- | ------------------------------------------ |
| Fichero SQLite     | Desarrollo local          | ninguna (o `DATABASE_URL=file:./data/app.db`) |
| Turso (libSQL)     | Staging y producción      | `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`  |

`DATABASE_URL` tiene prioridad sobre `TURSO_DATABASE_URL`, así que puedes poner la URL de Turso en cualquiera de las dos. Si no defines ninguna, se usa `file:./data/app.db`.

> **No definas los dos destinos a la vez.** Si `DATABASE_URL` apunta a un fichero `file:` y `TURSO_DATABASE_URL` a Turso, la aplicación arranca con un error `CONFIGURACION_BD_AMBIGUA` en lugar de elegir uno en silencio. Un valor en blanco cuenta como no definido, así que puedes dejar las variables de Turso vacías en `.env.local` mientras programas en local.

### Configurar Turso

1. Instala la CLI de Turso y autentícate:

   ```bash
   npm i -g @tursodatabase/cli
   turso auth login
   ```

2. Crea la base de datos y genera un token con permisos de lectura y escritura:

   ```bash
   turso db create firma-digital
   turso db tokens create --read-write
   ```

   Guarda el token: es la credencial de la aplicación.

3. Configura el entorno:

   ```bash
   TURSO_DATABASE_URL=libsql://firma-digital-<org>.turso.io
   TURSO_AUTH_TOKEN=<token>
   ```

4. Aplica el esquema y arranca:

   ```bash
   pnpm db:deploy:turso
   pnpm dev
   ```

El token **nunca** va dentro de la URL. En el runtime se pasa como parámetro del cliente, de modo que no aparece en logs ni en mensajes de error de conexión. La única excepción es el CLI de Prisma: `prisma migrate deploy` solo conoce `datasource.url`, así que ahí el token se añade como `?authToken=` en el proceso del CLI (ver `prisma.config.ts`). Si el token es de solo lectura, el despliegue fallará al intentar escribir el esquema.

La configuración se valida al arrancar, no en la primera consulta. Si falta el token, la aplicación falla de inmediato con un mensaje que nombra la variable concreta en lugar de un error de conexión.

### Por qué `db:deploy:turso` y no `prisma migrate deploy`

El motor de migraciones de Prisma es un binario Rust que solo entiende rutas de SQLite locales. Con `provider = "sqlite"` rechaza el esquema `libsql://`:

```
Error: P1013: The provided database string is invalid. The scheme is not recognized in database URL.
```

Falla igual en `migrate deploy`, en `db push` y en `db execute`. No es un problema de configuración: el motor no habla el protocolo libSQL. La conexión en runtime sí funciona, porque el adaptador `@prisma/adapter-libsql` sí lo habla.

Por eso `db:deploy:turso` (`scripts/db-turso-migrate.ts`) genera el SQL del schema con `prisma migrate diff`, que no necesita conexión, y lo aplica con `executeMultiple()` de `@libsql/client`. Registra el checksum en la tabla `_prisma_migrations`, de modo que:

- Es **idempotente**: volver a ejecutarlo con el mismo schema no toca la base de datos.
- Si `prisma/schema.prisma` ha cambiado desde la última aplicación, el checksum no coincide y el script **falla** en lugar de dejar el esquema a medias, indicando que hay que aplicar el cambio a mano.

Limitación conocida: el script solo sabe aplicar el diff completo del schema, no una secuencia de migraciones incrementales. Si el esquema cambia mucho a partir de ahora, revisa el SQL a mano o usa `turso db shell`.

### Migrar los datos del SQLite local a Turso

Turso no lee ficheros SQLite en directo, así que el volcado es un paso explícito:

```bash
# 1. Exportar el fichero local
turso db export ./data/app.db

# 2. Importarlo en Turso
turso db import ./export.sql

# 3. Asegurar que el esquema está al día
pnpm db:deploy:turso
```

Hazlo con la aplicación parada para no exportar a medias, y recuerda que `data/app.db` contiene datos personales sujetos al RGPD: bórralo cuando ya no lo necesites. Alternativa equivalente: `turso db shell <db> < ./data/app.db` para volcar un SQLite a SQL, y luego importar ese SQL.

## Despliegue

- Tras clonar o actualizar, ejecuta `pnpm db:generate` y `pnpm db:deploy:turso` antes de `pnpm build` si el destino es Turso, o `pnpm db:deploy` si es SQLite local.
- El destino de la base de datos lo decide el entorno: con `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` definidos, `db:deploy:turso` aplica el esquema en Turso y la aplicación escribe allí. Sin ellos, sigue usando el fichero SQLite local.
- Con SQLite local, **una sola instancia** de la aplicación puede escribir sobre `data/app.db`: con varias réplicas o instancias de Node, las escrituras concurrentes fallan con `database is locked`. Por eso SQLite es solo para desarrollo.
- En producción con Turso, la URL y el token se configuran como variables de entorno del proveedor de hosting, nunca en un fichero versionado.
- Turso añade latencia de red a cada consulta porque el transporte es HTTP. Para el volumen actual (formulario y panel) es aceptable; si hiciera falta, el siguiente paso sería réplicas de lectura o pooling.

## Datos personales y copias de seguridad

`data/app.db` contiene datos personales (nombre, email, teléfono, NIF, dirección y documento de identidad) sujetos al RGPD. Está en `.gitignore` y **no debe subirse a ningún repositorio**.

Copia de seguridad:

```bash
cp data/app.db "copias/app-$(date +%F).db"
```

El backup debe hacerse con la aplicación parada, o usando el modo WAL de SQLite, para no copiar un fichero a medias. Restauro: para volver al estado anterior, para la aplicación y sustituye `data/app.db` por la copia.

Borrado de datos: para eliminar una solicitud y su historial hay que borrarla en la base de datos (por ejemplo con `pnpm db:studio`); la interfaz no ofrece borrado porque el historial es de solo adición.
