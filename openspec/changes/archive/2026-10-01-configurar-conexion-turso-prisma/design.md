## Context

El proyecto usa Next.js 16 (App Router, React 19) con Prisma 7 sobre SQLite local. La conexión vive hoy en `data/db.ts:11`, que construye un adaptador `PrismaBetterSqlite3` con una única variable `DATABASE_URL` y, si no está definida, cae a `file:./data/app.db`.

Turso es un fork distribuido de SQLite (libSQL) con endpoint HTTP y autenticación por token. Para que Prisma hable con Turso hay dos caminos sobre el mismo protocolo HTTP:

- `@prisma/adapter-libsql` (`libsql`): habla el protocolo libSQL nativo (`libsql://`, `wss://`) con el cliente `@libsql/client`. Soporta replicación a ficheros locales y soporta `file:` como URL.
- `prisma-adapter-turso` + `@libsql/client/web`: cliente HTTP de libSQL pensado para entornos edge/browser.

Ambos son adaptadores, no un cambio de `provider` en el schema: `datasource db` se queda en `sqlite` porque Turso habla el mismo dialecto SQLite, y el generator tampoco cambia.

Restricciones del proyecto ya documentadas en `design.md` de specs previas: el schema usa `String` en lugar de enums porque SQLite no restringe tipos, y la validación vive en zod y en la capa de tipos del DAL. Este cambio no altera el modelo de datos, solo el transporte.

## Goals / Non-Goals

**Goals:**

- Que `data/db.ts` resuelva la URL de conexión a partir de Turso cuando esté configurada, sin cambiar la firma pública de `prisma` ni de `getDatabaseUrl()`.
- Usar un driver HTTP (no nativo) para que funcione en runtime Node de Vercel sin dependencias de sistema ni filesystem de escritura.
- Mantener el desarrollo local funcionando sin credenciales de Turso.
- Detectar configuración inválida de forma temprana y con un error accionable, en vez de fallar en la primera query.
- Documentar las variables de entorno sin filtrar el token.

**Non-Goals:**

- Cambiar el `provider` del datasource, el generator, o el modelo de datos.
- Escribir migraciones de datos desde el SQLite local hacia Turso (el mecanismo de dump/import se documenta, no se automatiza).
- Configurar réplicas, branching de Turso, o pooling dedicado.
- Cambiar el comportamiento de `request-export` o de cualquier otra capacidad existente.

## Decisions

### D1: `libsql://` como esquema de URL, no `prisma+libsql://`

El adaptador `@prisma/adapter-libsql` acepta la URL tal cual. Usamos `DATABASE_URL=libsql://<db-name>-<org>.turso.io` y `TURSO_AUTH_TOKEN`.

Alternativa descartada: el prefijo `prisma+libsql://` que aparece en guías antiguas de Prisma+Turso. El adaptador actual ya no lo requiere y `libsql://` es la forma que documenta Turso y Prisma hoy, además de ser la que aceptan `turso db shell` y otras herramientas. Como `getDatabaseUrl()` es opaca para el resto del código, la elección no tiene coste de refactor.

### D2: Mantener `getDatabaseUrl()` como API y conservar el fallback local

`getDatabaseUrl()` se mantiene exportada con la misma firma. Cambia su cuerpo: la resolución pasa a ser `process.env.DATABASE_URL ?? process.env.TURSO_DATABASE_URL ?? DEFAULT_DATABASE_URL`.

El orden pone `DATABASE_URL` primero porque es la que ya está documentada en `.env.example` y es la que usa `prisma migrate dev`; de ese modo una sola variable sigue sirviendo para ambos casos y nadie que ya tenga un `.env` funcional ve un cambio de comportamiento. Turso entra como segunda opción explícita, y el fichero local sigue siendo el último recurso.

### D3: Validar la configuración al importar el módulo, no en la primera query

`data/db.ts` es `server-only` y se importa en el arranque de cualquier ruta que toque la base de datos. Validamos con zod (ya es dependencia del proyecto) en un módulo aparte, para que la lógica sea testeable sin tocar el singleton de Prisma.

La lógica se reparte en dos ficheros siguiendo el patrón que el proyecto ya usa con la autenticación (`lib/auth.ts` puro + `data/admin-config.ts` que lee el entorno):

- `lib/db-config.ts`: puro. `resolveDatabaseConfig(env)` recibe el entorno como argumento y no lee `process.env` ni importa `server-only`, de modo que se puede ejercitar sin red, sin fichero de base de datos y fuera del bundler de React.
- `data/db-config.ts`: `server-only`. `getDatabaseConfig()` lee `process.env` y delega en la función pura.

El split no es cosmético: un módulo con `import "server-only"` lanza al ser importado fuera de un bundle de servidor de React, así que la validación no sería comprobable de forma aislada si viviera en un solo fichero de `data/`.

La regla es: si hay URL de Turso pero no hay token, es un error de configuración y se lanza. Si no hay URL de Turso, no se exige token. Esto evita el fallo confuso de "connection refused" y da un mensaje que dice exactamente qué variable falta.

Además, un `file:` de desarrollo junto a una URL de Turso se considera configuración ambigua y se rechaza, para que nadie publique a producción pensando que escribe en local.

Una cadena vacía o solo con espacios en una variable de entorno cuenta como ausente, no como valor inválido. En un `.env` es habitual dejar `DATABASE_URL=` en blanco, y eso debe equivaler a "no definida" en lugar de producir un error de validación que no nombra ninguna variable.

El tipo de la configuración resuelta es una unión discriminada por `driver`, con `authToken: string` en la rama de Turso y `authToken: null` en la local. Narrowing por `driver` deja el invariante del token garantizado por los tipos, sin `!` ni `??` al construir el adaptador.

### D4: El token se lee en runtime, nunca se pasa por la URL

`TURSO_AUTH_TOKEN` viaja como parámetro del constructor del cliente libSQL, no incrustado en `DATABASE_URL`. Esto evita que la URL quede registrada en logs, en mensajes de error de conexión, o en el output de `prisma studio`, y mantiene la posibilidad de rotar el token sin tocar la URL.

Excepción única y deliberada: el CLI de Prisma. `prisma migrate deploy` no recibe un objeto de configuración de cliente, solo conoce `datasource.url`, así que para autenticar contra Turso el token tiene que viajar en la URL como `?authToken=`. Ver D6. Ese es el único punto del proyecto donde el token aparece en una URL, y ocurre en el proceso del CLI, nunca en el runtime de la aplicación.

### D5: Mantener el singleton de `globalThis` sin cambios

El patrón de `data/db.ts:16` ya resuelve el problema de pools duplicados por hot reload. El adaptador HTTP de libSQL es stateless por petición, así que no se añade lógica de cierre de conexiones ni cambios de ciclo de vida. Un cambio aquí sería ruido.

### D6: `prisma migrate dev` en local; el esquema de Turso se aplica con un script propio

**Corrección sobre la versión original de esta decisión.** La primera redacción daba por hecho que `prisma migrate deploy` podía aplicarse contra Turso. Es falso, y se verificó contra la base de datos real: el motor de migraciones de Prisma es un binario Rust que solo entiende rutas de SQLite locales, así que con `provider = "sqlite"` rechaza el esquema `libsql://` con `P1013: The scheme is not recognized in database URL`. Falla igual en `migrate deploy`, en `db push` y en `db execute`, y también con `sqlite:`. No es un problema de configuración: el motor no habla libSQL. El adaptador `@prisma/adapter-libsql` sí lo habla, que es por lo que la conexión en runtime funciona.

La consecuencia es que el CLI de Prisma solo sirve para el destino local:

- `db:migrate` (`prisma migrate dev`): crea y aplica migraciones contra el fichero local. Es el único comando que genera SQL de migración nuevo.
- `db:deploy:turso` (`scripts/db-turso-migrate.ts`): aplica el esquema a Turso. Genera el SQL con `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`, que no necesita conexión, y lo ejecuta con `executeMultiple()` de `@libsql/client`, pensado para scripts SQL.
- `db:deploy` (`prisma migrate deploy`): se queda para el flujo local y **no** se usa contra Turso.

El script es idempotente: registra el checksum del SQL aplicado en `_prisma_migrations` y, si el esquema ya está aplicado con el mismo checksum, no hace nada. Si `schema.prisma` cambia después, el checksum deja de coincidir y el script falla indicando que hay que aplicar el cambio a mano, en lugar de dejar el esquema a medias. Esa es su limitación conocida: solo sabe aplicar el diff completo del schema, no migraciones incrementales.

`prisma.config.ts` tiene que compartir la resolución con el runtime, y para eso importa `resolveDatabaseConfig()` de `lib/db-config.ts`. Antes de este cambio ese fichero hardcodeaba `process.env.DATABASE_URL ?? "file:./data/app.db"`. Como el módulo puro no importa `server-only`, se puede usar tanto desde el CLI como desde el script; `data/db-config.ts` no serviría en ninguno de los dos.

## Risks / Trade-offs

- **El motor de migraciones de Prisma no puede hablar con Turso** → el esquema se aplica con un script propio que solo cubre el diff completo del schema, no migraciones incrementales. Mitigación: mientras el esquema no cambie, `db:deploy:turso` es idempotente y basta; cuando cambie, hay que revisar el SQL a mano. A medio plazo, la alternativa es generar el SQL de las migraciones incrementales y aplicarlo con `turso db shell`.
- **Errores de red intermitentes contra Turso** → se observaron `ConnectTimeoutError` en algunas ejecuciones y no en otras, con el mismo destino. Mitigación: el script y el cliente fallan de forma ruidosa, sin dejar estado a medias, porque el registro en `_prisma_migrations` solo se escribe después de aplicar el SQL.
- **URL de Turso sin permisos suficientes sobre el esquema** → el error aparece en el primer `db:deploy:turso`, no en el arranque. Mitigación: documentar que el token debe ser de lectura-escritura y que `db:deploy:turso` se ejecuta una vez por despliegue antes de la aplicación.
- **Latencia de red en cada query al ser HTTP en vez de acceso a fichero** → mitigado por el carácter síncrono del flujo actual (peticiones de firma, panel admin) que no tiene una carga alta. Se acepta como coste de la base distribuida; no se mitiga con pooling en este cambio.
- **`import.meta`/bundling del cliente libSQL en el runtime de Next.js** → Mitigación: el adaptador se importa solo desde `data/db.ts`, que es `server-only`, así que nunca entra en el bundle del cliente. Si apareciera un error de resolución de módulos, se aísla con `serverExternalPackages` antes que moviendo la inicialización a un archivo.
- **Pérdida de acceso al fichero local en entornos serverless read-only** → es precisamente la razón del cambio; el fallback `file:` se documenta como exclusivo de desarrollo.
- **Token filtrado en un commit** → el token va en `.env`, que ya está en `.gitignore`, y `.env.example` solo lleva el nombre de la variable. Mitigación adicional: revisar que ningún artefacto generado por `db:studio` se versiona.

## Migration Plan

1. Añadir `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` al entorno local y a `.env.example` (valores vacíos, comentados).
2. Instalar `@prisma/adapter-libsql` y `@libsql/client` como dependencias, quitar `@prisma/adapter-better-sqlite3` solo cuando el fallback local deje de usarse (D2 mantiene ambos, así que se conserva).
3. Cambiar `data/db.ts` para resolver la URL y construir el adaptador, y extraer la validación a `data/db-config.ts`.
4. Verificar en local que el fallback `file:` sigue funcionando: `pnpm db:generate && pnpm db:migrate && pnpm dev`.
5. Verificar contra Turso en un entorno de pruebas: `pnpm db:deploy:turso` y una escritura/lectura de prueba.
6. `pnpm typecheck` y `pnpm lint`.
7. Para llevar datos existentes a Turso: `turso db export <file>` / `turso db import <file>` (documentado, fuera de automatismo).

Rollback: revertir `data/db.ts` y `data/db-config.ts` a la resolución por `DATABASE_URL` y unsetear las variables de Turso. El schema y las migraciones no cambian, así que el rollback no toca datos.

## Open Questions

- ¿Se quiere también una réplica local (`libsql://file:...?...replica=...`) para que las lecturas en desarrollo no dependan de la red? Afecta al coste de la conexión y queda fuera de este cambio.
- ¿El token de Turso se rota con alguna frecuencia, y eso implica un mecanismo de redeploy documentado?
- ¿Hacen falta varias réplicas (`replicas:` en la URL) cuando haya producción, o la configuración de un solo primary cubre el volumen esperado?
