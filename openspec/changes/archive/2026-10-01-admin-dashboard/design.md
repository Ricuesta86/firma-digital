## Context

`firma-digital` es una landing de Next.js 16 (App Router) con un formulario público que, mediante una Server Action, valida con zod y envía un correo con Nodemailer. No hay base de datos, ni sesiones, ni rutas privadas. El "registro" de solicitudes es exclusivamente el correo.

El panel de administración introduce las tres piezas que hoy no existen en el proyecto: **persistencia**, **autenticación** y **UI de gestión**. Es la primera vez que el proyecto se despliega con estado en servidor, lo que hace que las decisiones de esquema, de acceso a datos y de aislamiento de secretos tengan consecuenciaspara todo el código posterior.

Restricciones y hechos verificados sobre el stack actual:

- Next.js **16.3.6** — `middleware.ts` está **deprecado** y renombrado a `proxy.ts` (función exportada `proxy`); Proxy corre por defecto en **runtime Node.js** desde la v16.
- Next.js 16 exige `await` en `params`, `searchParams` y `cookies()` (son `Promise`).
- Tailwind v4 (CSS-first, `@import "tailwindcss"`), sin librería de componentes UI.
- `@/*` como alias de path. `strict: true`. Scripts disponibles: `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- No hay framework de tests configurado. La verificación es `lint` + `typecheck` + `build` + comprobación manual.
- El formulario público y `lib/validation.ts` son la única fuente de verdad del dominio; sus enums (`documentTypes`, `certificateTypes`) se reutilizarán como origen para la base de datos.
- Los datos son **personales** (nombre, NIF, documento de identidad, teléfono): aplica RGPD, el panel no puede ser público ni filtrar datos a terceros.

## Goals / Non-Goals

**Goals:**

- Persistir cada solicitud válida del formulario público de forma fiable, sin depender del correo.
- Proteger todo el panel con una única credencial de administrador robusta, con defensa en profundidad.
- Ofrecer al equipo: listado con búsqueda y filtros, ficha de detalle, métricas, gestión de estado con historial, notas internas y exportación CSV.
- Respetar la arquitectura recomendada por Next.js 16: Data Access Layer, `server-only`, verificación de autorización en cada punto de entrada y DTOs mínimos.
- Mantener el cambio aditivo y reversible: si se revierte, la landing pública sigue funcionando.

**Non-Goals:**

- Multiusuario, roles o permisos granulares. Hay exactamente un administrador.
- Registro de admins, recuperación de contraseña, o verificación por email (2FA).
- Envío de correos transaccionales al cliente (confirmaciones, respuestas al solicitante) más allá del aviso actual.
- Adjuntos de documentos, subida de ficheros o verificación de identidad real.
- Reemplazar Nodemailer, rediseñar la landing o tocar `components/contact-form.tsx`.
- Despliegue en multi-servidor o escalado horizontal (SQLite es un fichero local).
- Internacionalización: la UI del panel se mantiene en español, igual que el resto del sitio.

## Decisions

### D1 — Prisma 7 + SQLite con driver adapter, no el motor nativo

**Elección:** Prisma `7.10.0` (estable; `latest` en npm apunta a `8.0.0-rc`, una release candidate que se descarta) sobre SQLite mediante el driver adapter `@prisma/adapter-better-sqlite3`.

Consecuencias asumidas de la v7, que **no** son las de v5 y hay que respetar:

- La URL de conexión vive en `prisma.config.ts` (`defineConfig({ datasource: { url } })`), **no** en `schema.prisma`.
- El generador es `provider = "prisma-client"` con `output` explícito, y el cliente se importa desde la ruta generada.
- Se requiere el driver adapter; el motor Rust embebido ya no es el camino por defecto.
- `better-sqlite3` es un módulo nativo → añadirlo a `serverExternalPackages` en `next.config.ts` (junto a `nodemailer`, que ya está).

**Alternativas descartadas:**

- *Prisma 5/6 con motor embebido*: menos dependencias, pero la v7 ya es la estable y fijar una major antigua suma deuda inmediata.
- *`better-sqlite3` sin ORM*: menos Indirecta, pero se pierde el tipado de los datos y las migraciones versionadas. En un proyecto con dos tablas y admin se pierde valor.
- *Postgres gestionado*: innecesario para el volumen esperado; obliga a operar infraestructura para un panel de un solo usuario.
- *Fichero JSON plano*: no aporta consultas, filtros ni agregaciones de forma fiable, y es propenso a condiciones de carrera en escrituras concurrentes.

### D2 — Estados y enums como `String` validados por zod, no `enum` de Prisma

SQLite no aplica restricciones de tipo a nivel de base de datos, y el soporte de `enum` en Prisma + SQLite es limitado. Un valor inválido persistido produciría un fallo en tiempo de lectura, no de escritura.

Por tanto: `status`, `certificateType` y `documentType` son `String` en el esquema, y la validez la garantizan un schema zod (`lib/request-status.ts`, `lib/validation.ts`) y el TypeScript derivado del enum. El tipo generado por Prisma para esos campos es `string`; una capa de tipos propia (`RequestStatus` como unión) es la que se usa en el DAL, de modo que un dato corrupto se detecta y se reporta en vez de propagarse.

**Justificación:** el dominio tiene 4 estados y 4 tipos de certificado, y ya están validados en el punto de entrada con zod 4. Duplicar la garantía en la base de datos no aporta y complica las migraciones.

### D3 — `proxy.ts` para la navegación, DAL para la seguridad real

**Elección:** un `proxy.ts` en la raíz hace solo *redirección de navegación* (si no hay sesión válida y la ruta es `/admin/*` → `/admin/login`; si hay sesión y se pide `/admin/login` → `/admin`). La **autorización efectiva** se aplica en el DAL, que es la única capa que habla con la base de datos y la única que lee `process.env` de admin.

Motivo directo de la documentación de Next.js 16: las Server Functions no son rutas en la cadena del Proxy, se atienden como `POST` sobre la ruta que las usa, y *"un cambio en el matcher puede eliminar silenciosamente la cobertura del Proxy"*. Además, *"la comprobación a nivel de página no se extiende a las Server Actions definidas dentro de ella"*. Confiar solo en Proxy sería un fallo de seguridad.

**Alternativas descartadas:**

- *Auth.js / NextAuth v5*: resuelve sesiones reales, pero aporta complejidad y dependencias disproportionate para un único admin con credencial en variables de entorno.
- *Sin Proxy, solo checks en cada página*: más simple aún, pero obliga a repetir el redirect en cada página y el layout se convierte en el único punto de cobertura, que es frágil.
- *Proxy como única barrera*: descartado por lo indicado arriba.

### D4 — Sesión con cookie firmada HMAC-SHA256, sin librería

La cookie `fd_admin_session` lleva `base64url(payload).base64url(HMAC-SHA256(payload, ADMIN_SESSION_SECRET))`, con payload `{ email, issuedAt, expiresAt }` y caducidad de 8 horas.

- La comparación de la firma usa `crypto.timingSafeEqual` (Node) para evitar fugas por temporización, con comprobación previa de longitud.
- La comparación de credenciales en el login también es constant-time.
- Flags: `httpOnly`, `sameSite: "lax"`, `secure` en producción, `path: "/"`, `maxAge` alineado con la expiración.
- El payload **no** incluye la contraseña ni ningún secreto; solo identidad y vigencia. La cookie no necesita estado en servidor, por lo que no hay tabla de sesiones que invalidar.
- `ADMIN_SESSION_SECRET` es obligatoria en producción; si falta, el login falla con un mensaje explícito en vez de degradar a un modo inseguro.

**Alternativas descartadas:**

- *`jose`*: bien resuelta y portable, pero es una dependencia para un HMAC de una línea.
- *Sesión en base de datos*: permite revocación inmediata, desproporcionado para un admin único; se acepta que rotar `ADMIN_SESSION_SECRET` cierre todas las sesiones.
- *JWT sin firma propia*: un JWT firmado es esencialmente lo mismo con más superficie.

### D5 — Data Access Layer en `data/` con `server-only`, y Server Actions finas

Se separa en dos capas siguiendo la guía de seguridad de datos de Next.js 16:

- `data/requests.ts` — **DAL**. Contiene las consultas y mutaciones, marca `import "server-only"`, verifica la sesión en cada función y devuelve **DTOs** mínimos.
- `data/db.ts` — **único sitio que instancia Prisma** (singleton con driver adapter).
- `data/admin-config.ts` — **único sitio que lee `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_SESSION_SECRET`**. No importa `next/headers`, para que `proxy.ts` pueda leer el secreto sin arrastrar el DAL de cookies.
- `lib/auth.ts` — **puro**: firma, verifica y compara, pero recibe el secreto y las credenciales esperadas como argumentos. No lee cookies, ni `process.env`, ni la base de datos.
- `app/admin/actions.ts` — **Server Actions** finas. Reciben `FormData`, delegan en el DAL y llaman a `revalidatePath`. No tocan Prisma.

Reglas que se aplican sin excepción:

1. Toda Server Action y todo Route Handler revalida la sesión **dentro** de la acción, nunca confiando en el redirect de la página.
2. Todo parámetro de ruta y de `searchParams` se valida con zod antes de usarse. `searchParams` no se usa nunca como bandera de autorización.
3. Las Server Actions devuelven `{ success, error? }`, nunca un registro de la base de datos.
4. `data/db.ts` es un singleton (patrón `globalThis` de la documentación de Prisma) para no abrir un pool por hot-reload en desarrollo.

**Motivo de `data/` y no `lib/`:** el proyecto ya usa `lib/` para utilidades transversales (`email.ts`, `validation.ts`). Un directorio `data/` separa de forma explícita la capa con acceso a datos personales y secretos, y hace trivial verificar por auditoría que ninguna otra carpeta importa Prisma.

### D6 — Máquina de estados explícita y transiciones registradas

Estados: `NEW`, `IN_REVIEW`, `ACCEPTED`, `REJECTED`.

Transiciones permitidas:

| Desde        | Hacia                                |
| ------------ | ------------------------------------ |
| `NEW`        | `IN_REVIEW`, `REJECTED`              |
| `IN_REVIEW`  | `ACCEPTED`, `REJECTED`               |
| `ACCEPTED`   | `IN_REVIEW`                          |
| `REJECTED`   | `IN_REVIEW`                          |

`NEW → ACCEPTED` está **prohibida** a propósito: ninguna solicitud se acepta sin pasar por revisión. Una transición no permitida se rechaza con un mensaje de error y **no** modifica el registro. Cada transición válida inserta una fila en `RequestStatusEvent` con estado origen, destino y nota opcional, en la **misma transacción** que la actualización de `status`. El historial es append-only y no se expone ninguna vía para editarlo o borrarlo.

### D7 — El envío de correo pasa a ser best-effort y la persistencia es la fuente de verdad

Este es el cambio de comportamiento que más riesgo tenía. El orden en `requestSignature` es: validar → **persistir** → notificar.

- Si la escritura falla, se devuelve error al usuario y no se envía correo: es preferible no tener solicitud a tener una solicitud fantasma.
- Si el correo falla, la solicitud **ya está guardada**; se registra `notificationSentAt = null` y `notificationError` con el motivo, y se devuelve el mensaje de éxito al usuario. Un fallo de SMTP ya no pierde solicitudes, que era el fallo estructural del diseño actual.
- `privacyConsent` se persiste como marca de auditoría, ya que el formulario la exige.

Se conserva el envío del aviso con el mismo formato (`lib/email.ts` sin cambios de plantilla) para no romper el proceso comercial ya conocido por el equipo.

### D8 — Paginación por offset y búsqueda con `contains`

Para el volumen esperado (decenas o cientos de solicitudes) la paginación por offset con `pageSize` fijo de 20 es suficiente y mucho más simple que la paginación por cursor. `skip` degrada en tablas muy grandes, riesgo aceptado y documentado.

La búsqueda usa `contains` sobre `fullName`, `email`, `companyName` y `nif`. SQLite no soporta FTS5 a través de Prisma, y montar la búsqueda con `LIKE` sobre estos cuatro campos cumple el objetivo sin complexity adicional.

### D9 — Exportación CSV como Route Handler, no como Server Action

`GET /api/admin/export` devuelve el CSV con `Content-Type: text/csv; charset=utf-8` y `Content-Disposition: attachment`. Reutiliza los mismos parámetros de filtro del listado (`q`, `status`, `certificateType`) leyendolos de la query string.

Es un Route Handler y no una Server Action porque el resultado es una descarga binaria y no el retorno de una mutación. El handler revalida la sesión por sí mismo y devuelve `401` en JSON si falta, en lugar de redirigir.

Detalles de correctitud del CSV: BOM UTF-8 al principio (para que Excel respete los acentos en "razón social", "Firma cualificada"), escapado de comillas y comas, y sanitización de valores que empiezan por `=`, `+`, `-` o `@` para evitar la inyección de fórmulas al abrir el fichero en una hoja de cálculo. Las notas internas y el historial **no** se exportan, por ser datos de trabajo interno.

### D10 — Datos de sesión y caché

Todas las lecturas del panel se marcan como dinámicas (`connection()` de Next 16 o equivalente) para que un listado no se sirve desde el Full Route Cache. Sin esto, un cambio de estado podría no reflejarse hasta el siguiente despliegue.

No se habilita `cacheComponents` ni `use cache` en este cambio: no son una optimización necesaria aquí para el volumen esperado. Se dejan como mejora futura.

## Risks / Trade-offs

**[Prisma 7 es una major reciente y su configuración (driver adapter, `prisma.config.ts`, `output` del generador) cambia respecto a la v5 que puede aparecer en documentación antigua indexada]** → Fijar versiones exactas en `package.json` (`prisma@7.10.0`, `@prisma/client@7.10.0`, `@prisma/adapter-better-sqlite3@7.10.0`) y verificar la instalación en la primera tarea, antes de escribir código de aplicación. Si el arranque falla por la v7, la alternativa es fijar Prisma 6, que reduce el cambio a la configuración clásica — decisión que se toma con el proyecto ya en marcha, no antes.

**[Los datos personales (NIF, documento de identidad) quedan en un fichero SQLite en el disco]** → Añadir `data/`, `*.db` y `*.db-journal` a `.gitignore`; documentar en el README que el fichero contiene datos personales sujetos a RGPD, que no debe subirse a ningún repositorio y que su copia de seguridad es responsabilidad del despliegue.

**[Una única credencial compartida para todo el equipo]** → Aceptado como límite explícito de esta primera versión. Mitigaciones: contraseña fuerte generada con `openssl rand`, rotable sin más que cambiar la variable de entorno; el acceso se registra en el historial de estados. Si aparece la necesidad de varios usuarios, la migración natural es sustituir D4 por Auth.js conservando el DAL, porque la capa de datos no depende del mecanismo de sesión.

**[`contains` en SQLite es case-insensitive solo para ASCII según la collation por defecto]** → Los nombres y NIF con acentos o ñ pueden no coincidir en la búsqueda. Se acepta en esta versión; si molesta, la mitigación es normalizar a una columna de búsqueda en minúsculas al escribir.

**[El volumen de la tabla hace que `skip` degrade y que las métricas agregadas escaleen todo el conjunto]** → Hoy es irrelevante. El punto de reevaluación es un contador de total visible en el propio panel: si aparece en la UI, ya se sabe cuándo actuar.

**[La cookie es stateless: no hay forma de cerrar la sesión de forma remota sin rotar el secreto]** → El logout borra la cookie. La rotación de `ADMIN_SESSION_SECRET` invalida todas las sesiones activas, lo que sirve de mecanismo de emergencia documentado.

**[Depender de un único fichero SQLite limita el despliegue a una instancia]** → Documentado en el README como limitación. El cambio a Postgres es un cambio de `provider` y de adapter, no de la capa de aplicación, porque el DAL encapsula Prisma.

**[`proxy.ts` es una API nueva en la v16 y su semántica puede evolucionar en versiones futuras]** → El Proxy solo hace redirección y nunca autoriza por sí mismo (D3), así que una regresión ahí degrada la experiencia de navegación, no la seguridad. La barrera real está en el DAL.

## Migration Plan

No hay migración de datos: la base de datos es nueva y no existe información previa que preservar. El historial de solicitudes anterior vive únicamente en correos.

1. `pnpm add @prisma/client@7.10.0 @prisma/adapter-better-sqlite3@7.10.0` y `pnpm add -D prisma@7.10.0`.
2. Crear `prisma/schema.prisma`, `prisma.config.ts` y `prisma/seed.ts`.
3. `pnpm prisma migrate dev --name init` (crea `data/app.db`).
4. Añadir `data/`, `*.db*` a `.gitignore` y las variables `ADMIN_*` a `.env.example` y `.env.local`.
5. `pnpm prisma generate`, `pnpm build`.
6. Verificación manual: enviar el formulario público y comprobar que aparece en `/admin`.

**Rollback:** revertir el commit. La landing pública sigue funcionando sin tocar nada más — es el motivo de que la captura se implemente como cambio aditivo y no como reescritura de `requestSignature`. Si la base de datos llegara a contener solicitudes y hubiera que revertir, copiar `data/app.db` antes: al revertir el código, las solicitudes seguirían existiendo solo en ese fichero. La email sigue siendo el canal de negocio de referencia, así que ninguna solicitud comercial se pierde por un rollback.

## Open Questions

- **Enums de Prisma con SQLite en la v7**: no está verificado si la v7 soporta `enum` con `provider = "sqlite"`. El diseño asume que no (D2) y usa `String` + zod, que es seguro en ambos casos. Si sí soporta `enum`, migrar los tres campos a `enum` es una mejora de la que no depende ninguna funcionalidad.
- **Llamadas repetidas a `prisma` en desarrollo**: confirmar que el singleton por `globalThis` evita el aviso de hot-reload y el agotamiento de conexiones en `pnpm dev`; si aparece, un `prisma.$disconnect()` en `beforeExit` no es necesario y basta con aceptar el warning.
- **Formato de fecha en el CSV**: se asume ISO 8601. Confirmar si el equipo comercial lo necesita en formato español (`dd/mm/aaaa hh:mm`).
- **Límite de `maxAge` de la cookie**: 8 horas es una decisión provisional. Confirmar con el equipo si la jornada real de trabajo admin la cubre.
