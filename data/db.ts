import "server-only";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";

import { PrismaClient } from "@/lib/generated/prisma/client";
import { getDatabaseConfig, type DatabaseConfig } from "@/data/db-config";

/**
 * Instancia única del cliente de Prisma.
 *
 * El transporte depende de la URL resuelta (D1): `libsql://` habla el protocolo
 * HTTP de libSQL contra Turso y `file:` usa SQLite en local. La decisión, la
 * precedencia de variables y la validación viven en `data/db-config.ts`; aquí
 * solo se construye el adaptador y se sostiene el singleton.
 *
 * `getDatabaseConfig()` se evalúa al importar el módulo, así que una
 * configuración incoherente falla al arrancar y no en la primera query.
 */

/** URL de conexión efectiva. Mismo nombre y firma que antes de este cambio. */
export function getDatabaseUrl(): string {
  return getDatabaseConfig().url;
}

/**
 * Construye el adaptador que corresponde a la URL resuelta.
 *
 * El token se pasa como campo del config de libSQL, nunca concatenado a la URL,
 * para que no acabe en logs ni en mensajes de error de conexión (D4).
 */
function createAdapter(config: DatabaseConfig) {
  if (config.driver === "turso") {
    return new PrismaLibSql({ url: config.url, authToken: config.authToken });
  }

  return new PrismaBetterSqlite3({ url: config.url });
}

// Patrón de singleton de la documentación de Prisma: en desarrollo el hot
// reload de Next.js reevalúa los módulos, y sin esto se abriría un nuevo pool
// de conexiones en cada recarga. Sin cambios de ciclo de vida: el adaptador de
// libSQL es stateless por petición y no necesita cierre explícito (D5).
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: createAdapter(getDatabaseConfig()) });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
