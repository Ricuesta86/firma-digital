import "dotenv/config";
import { defineConfig } from "prisma/config";

import { resolveDatabaseConfig } from "./lib/db-config";

/**
 * Configuración que usa el CLI de Prisma (`db:migrate`, `db:deploy`).
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
 */
const database = resolveDatabaseConfig({
  DATABASE_URL: process.env.DATABASE_URL,
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
});

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url:
      database.driver === "turso"
        ? `${database.url}?authToken=${encodeURIComponent(database.authToken)}`
        : database.url,
  },
});
