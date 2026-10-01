import "server-only";

/**
 * Lectura de la configuración de base de datos desde el entorno.
 *
 * Es el ÚNICO sitio del proyecto que lee `DATABASE_URL`, `TURSO_DATABASE_URL` y
 * `TURSO_AUTH_TOKEN`. `lib/db-config.ts` es puro y recibe el entorno como
 * argumento, de modo que la precedencia y la validación se pueden auditar y
 * probar sin tocar el proceso ni abrir una conexión (spec: Requirement
 * "Validación temprana de la configuración").
 */

import {
  resolveDatabaseConfig,
  type DatabaseConfig,
  type DatabaseEnv,
} from "@/lib/db-config";

export { DatabaseConfigError } from "@/lib/db-config";
export type { DatabaseConfig } from "@/lib/db-config";

/**
 * Configuración de la base de datos del proceso actual.
 *
 * @throws {DatabaseConfigError} si el entorno es incoherente. Se llama al
 * importar `data/db.ts`, así que el fallo aparece al arrancar la aplicación.
 */
export function getDatabaseConfig(): DatabaseConfig {
  return resolveDatabaseConfig(readEnv());
}

function readEnv(): DatabaseEnv {
  return {
    DATABASE_URL: process.env.DATABASE_URL,
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
  };
}
