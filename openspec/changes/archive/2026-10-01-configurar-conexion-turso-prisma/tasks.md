## 1. Dependencias

- [x] 1.1 Instalar `@prisma/adapter-libsql` y `@libsql/client` con pnpm, fijando la versión Major 7 para el adaptador
- [x] 1.2 Confirmar que `@prisma/adapter-better-sqlite3` se conserva (el fallback local de D2 lo sigue necesitando)

## 2. Resolución y validación de configuración

- [x] 2.1 Crear `data/db-config.ts` con la precedencia `DATABASE_URL` → `TURSO_DATABASE_URL` → `file:./data/app.db` (D2)
- [x] 2.2 Implementar con zod la validación: `libsql://` sin `TURSO_AUTH_TOKEN` es error; `file:` y `libsql://` a la vez es error (D3)
- [x] 2.3 Redactar los mensajes de error nombrando la variable concreta y cómo corregirla
- [x] 2.4 Separar la lógica pura de resolución en una función que reciba un `env` inyectado, para poder comprobarla sin red

## 3. Cliente de base de datos

- [x] 3.1 Reescribir `data/db.ts` para construir el adaptador según la URL resuelta: libSQL para `libsql://`, `PrismaBetterSqlite3` para `file:`
- [x] 3.2 Pasar `authToken` como parámetro del cliente, sin incrustarlo en la URL (D4)
- [x] 3.3 Conservar `getDatabaseUrl()` con su nombre y firma actuales
- [x] 3.4 Mantener el patrón de singleton sobre `globalThis` sin cambios en el ciclo de vida (D5)
- [x] 3.5 Compartir la resolución con el CLI en `prisma.config.ts` (no estaba previsto: el CLI hardcodeaba `DATABASE_URL ?? "file:..."` y nunca habría apuntado a Turso). Añadir `?authToken=` solo para el CLI, con la excepción a D4 documentada

## 4. Migraciones

- [x] 4.1 Anotar que `db:migrate` espera la URL local y `db:deploy:turso` aplica el esquema en Turso (D6). `package.json` es JSON y no admite comentarios, así que la anotación va en el README (tabla de scripts y sección de despliegue)
- [x] 4.2 Verificar que el esquema se aplica correctamente contra Turso. **D6 corregido:** `prisma migrate deploy` es inviable (P1013, el motor Rust no reconoce `libsql://`, igual que `db push` y `db execute`). Se añadió `scripts/db-turso-migrate.ts` + `db:deploy:turso`, que genera el SQL con `prisma migrate diff` (offline) y lo aplica con `executeMultiple()`. Verificado contra la BD real y confirmado idempotente en 3 ejecuciones seguidas

## 5. Documentación y entorno

- [x] 5.1 Añadir `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` a `.env.example` con valores vacíos y comentados
- [x] 5.2 Documentar en el README cómo crear la base de datos en Turso, generar el token y qué permisos necesita
- [x] 5.3 Documentar el procedimiento de `turso db export` / `turso db import` para llevar datos del SQLite local

## 6. Verificación

- [x] 6.1 Ejecutar `pnpm db:generate` y `pnpm typecheck`
- [x] 6.2 Ejecutar `pnpm lint`
- [x] 6.3 Verificar el fallback local: sin variables de entorno, `pnpm db:generate` y una escritura/lectura/borrado reales contra `file:./data/app.db` (`scripts/check-local-db.ts`)
- [x] 6.4 Verificar contra Turso: `libsql://` + token en entorno, escritura, lectura, relectura desde conexión nueva y borrado. Todo OK contra la BD real (`scripts/check-turso-db.ts`)
- [x] 6.5 Comprobar que el error de configuración se dispara con `libsql://` sin token, y que nombra la variable
- [x] 6.6 Confirmar que ninguna ruta importa el cliente en el bundle del navegador (el módulo sigue siendo `server-only`)

## 7. Añadido durante la implementación

- [x] 7.1 Dividir la configuración en `lib/db-config.ts` (puro) y `data/db-config.ts` (lee el entorno). `server-only` lanza fuera de un bundle de React, así que un único fichero de `data/` no era comprobable de forma aislada (D3)
- [x] 7.2 Compartir la resolución con `prisma.config.ts`; hardcodeaba `DATABASE_URL ?? "file:..."` y el CLI nunca habría apuntado a Turso (tarea 3.5)
- [x] 7.3 Tratar una variable en blanco como no definida, no como valor inválido (`scripts/check-db-config.ts`)
- [x] 7.4 Quitar `/data/` de `.gitignore`, que ignoraba la capa DAL completa y hacía incomiteable el cambio en `data/db.ts`. Los patrones `*.db` de abajo ya protegen la base de datos. Bug previo a este cambio, detectado al verificar qué se iba a commitear
- [x] 7.5 Sustituir `db:deploy` por `db:deploy:turso` tras descubrir que el motor de migraciones de Prisma no puede hablar libSQL. `db:deploy` se queda para el flujo local
