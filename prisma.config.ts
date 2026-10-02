import "dotenv/config";
import { defineConfig } from "prisma/config";

import { DatabaseConfigError, resolveDatabaseConfig } from "./lib/db-config";

/**
 * Configuración que usa el CLI de Prisma (`db:generate`, `db:migrate`, `db:deploy`).
 *
 * Comparte resolución y validación con el runtime a través de
 * `lib/db-config.ts`, que es puro y por tanto se puede importar desde aquí
 * (a diferencia de `data/db-config.ts`, que es `server-only`).
 *
 * Excepción al D4: para el motor de migraciones el token tiene que viajar en la
 * URL como `?authToken=`, porque el CLI no recibe un objeto de configuración de
 * cliente y solo conoce la `datasource.url`. Ese es el único punto del proyecto
 * donde el token aparece en una URL, y ocurre en el proceso del CLI, no en el
 * runtime de la aplicación. Ver design.md D4 y D6.
 *
 * La URL es condicional (D3 del diseño del pipeline de build): `prisma generate`
 * solo escribe el cliente generado y no abre ninguna conexión, así que no puede
 * fallar por una configuración de base de datos. `datasource` es opcional en la
 * configuración del CLI, de modo que se omite cuando el entorno no resuelve y la
 * generación sigue adelante; los comandos que sí conectan fallan entonces con el
 * mensaje del propio Prisma sobre `datasource.url`. La aplicación, en cambio,
 * sigue validando al arrancar en `data/db.ts`.
 */

/**
 * URL del datasource para el CLI, o `undefined` si el entorno no resuelve una
 * configuración coherente.
 */
function resolveCliDatasourceUrl(): string | undefined {
  try {
    const database = resolveDatabaseConfig({
      DATABASE_URL: process.env.DATABASE_URL,
      TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
      TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
    });

    return database.driver === "turso"
      ? `${database.url}?authToken=${encodeURIComponent(database.authToken)}`
      : database.url;
  } catch (error) {
    // Solo se absorben los errores de configuración conocidos. Cualquier otro
    // fallo (por ejemplo, no poder importar este módulo) debe seguir siendo
    // visible, en lugar de degenerar en un "falta datasource.url" que no explica
    // nada.
    if (!(error instanceof DatabaseConfigError)) throw error;

    return undefined;
  }
}

const datasourceUrl = resolveCliDatasourceUrl();

export default defineConfig({
  schema: "prisma/schema.prisma",
  ...(datasourceUrl ? { datasource: { url: datasourceUrl } } : {}),
});
