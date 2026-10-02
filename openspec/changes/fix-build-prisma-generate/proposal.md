## Why

El despliegue en Vercel falla en la fase de build con `Module not found: Can't resolve '@/lib/generated/prisma/client'`. La causa es que el generador `prisma-client` de Prisma 7 emite TypeScript en `lib/generated/prisma`, ese directorio está en `.gitignore` y por tanto no viaja al repositorio, y ninguna fase del build lo genera: en Vercel no hay nadie que ejecute `pnpm db:generate` antes de `next build`. El mismo hueco rompe `pnpm typecheck` y `pnpm lint` en cualquier clon limpio, y es un fallo silencioso de configuración del proyecto, no de la aplicación.

Reproducido y confirmado en local: con `lib/generated/` ausente, `pnpm build` aborta exactamente con ese error y `pnpm typecheck` falla con `TS2307`; con el directorio presente, ambos pasan.

## What Changes

- Declarar `postinstall: prisma generate` en `package.json`, de forma que el cliente se genere tras cada instalación y por tanto en la fase de install de Vercel, en Docker y en clonar el repositorio. Es la recomendación oficial de Prisma para Vercel y no requiere ningún fichero de configuración nuevo.
- Prefijar el script `build` con `prisma generate`, para que la propia construcción no dependa de que se hayan ejecutado los hooks de instalación (imágenes con `--ignore-scripts`, `installCommand` propio en el proveedor de hosting).
- Desacoplar `prisma generate` de la configuración de base de datos: hoy `prisma.config.ts` resuelve la configuración al cargarse y lanza `DatabaseConfigError` si el entorno está a medias, así que un build sin credenciales (por ejemplo un Preview de Vercel donde solo `TURSO_DATABASE_URL` está definida) falla con un error que no tiene nada que ver con generar código.
- Actualizar la sección de despliegue del README, que hoy instruye de ejecutar `pnpm db:generate` a mano antes de `pnpm build`, y documentar qué variables de entorno necesita el build frente a las que necesita el runtime.

## Capabilities

### New Capabilities

- `build-pipeline`: Generación del cliente de Prisma como parte automática del pipeline de instalación y build, su independencia respecto a la configuración de base de datos, y el procedimiento de despliegue documentado.

### Modified Capabilities

- `turso-db-connection`: La validación de configuración deja de aplicarse al comando de generación, que no abre ninguna conexión; los comandos que sí conectan conservan la validación y su error accionable.

## Impact

- `package.json`: nuevos scripts `postinstall` y `build`. Sin dependencias nuevas.
- `prisma.config.ts`: la URL del datasource pasa a ser condicional; el resto de la configuración (schema, resolución compartida con el runtime) no cambia.
- `README.md`: sección de despliegue y tabla de scripts, que hoy describen un paso manual que dejará de existir.
- Sin cambios en el modelo de datos, en las migraciones, en `data/db.ts` ni en ninguna ruta de la aplicación: el fallo es previo al bundling y se arregla generando el código que el bundler espera.
