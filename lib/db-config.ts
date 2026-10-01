/**
 * Resolución y validación de la configuración de la base de datos.
 *
 * Módulo PURO: no lee `process.env` ni importa `server-only`, para que toda la
 * lógica de precedencia y validación se pueda ejercitar sin red, sin fichero de
 * base de datos y fuera del bundler de React (spec: Requirement "Validación
 * temprana de la configuración").
 *
 * `data/db-config.ts` es la capa que sí lee el entorno y delega aquí. El
 * diagnóstico y la precedencia viven en este fichero; la lectura de variables,
 * en el otro. Igual que `lib/auth.ts` y `data/admin-config.ts` (design.md D5).
 */

import { z } from "zod";

/** Último recurso: SQLite en local, solo para desarrollo. */
export const DEFAULT_DATABASE_URL = "file:./data/app.db";

const FILE_URL_PREFIX = "file:";

/**
 * Unión discriminada: el token es `string` en el destino Turso y `null` en el
 * fichero local. Narrowing por `driver` hace innecesario un `!` o un `??` al
 * construir el adaptador.
 */
export type DatabaseConfig =
  | { driver: "turso"; url: string; authToken: string }
  | { driver: "local-file"; url: string; authToken: null };

/** Configuración de base de datos incoherente. Lanza antes de intentar conectar. */
export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigError";
  }
}

function isFileUrl(url: string): boolean {
  return url.startsWith(FILE_URL_PREFIX);
}

/**
 * Cualquier esquema distinto de `file:` se trata como remoto. Ante un esquema
 * no reconocido preferimos exigir un token a tratar el destino como fichero
 * local en silencio, que escribiría en un fichero distinto del previsto.
 */
function isRemoteUrl(url: string): boolean {
  return !isFileUrl(url);
}

const MISSING_TOKEN_MESSAGE =
  "CONFIGURACION_BD_SIN_TOKEN: la URL de Turso está definida pero falta " +
  "TURSO_AUTH_TOKEN. Define TURSO_AUTH_TOKEN con un token de lectura y escritura " +
  "de tu base de datos de Turso, o quita TURSO_DATABASE_URL para usar el " +
  "fichero SQLite local.";

const AMBIGUOUS_TARGET_MESSAGE =
  "CONFIGURACION_BD_AMBIGUA: hay una URL local (file:) y una URL de Turso " +
  "configuradas a la vez, y la precedencia elegiría una en silencio. Deja solo " +
  "una: define DATABASE_URL con la URL de Turso en producción, o quita " +
  "TURSO_DATABASE_URL para trabajar contra el fichero local.";

const FALLBACK_MESSAGE =
  "CONFIGURACION_BD_INVALIDA: la configuración de la base de datos no es " +
  "válida. Revisa DATABASE_URL, TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en el " +
  "entorno; consulta .env.example.";

/**
 * Normaliza una variable de entorno: una cadena vacía o solo con espacios cuenta
 * como ausente. En un `.env` es habitual dejar `DATABASE_URL=` en blanco, y eso
 * debe equivaler a "no definida" en lugar de producir un error de validación.
 */
function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const envSchema = z
  .object({
    databaseUrl: z.string().trim().min(1).optional(),
    tursoDatabaseUrl: z.string().trim().min(1).optional(),
    tursoAuthToken: z.string().trim().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    const urls = [env.databaseUrl, env.tursoDatabaseUrl].filter(
      (url): url is string => url !== undefined,
    );

    if (urls.some(isFileUrl) && urls.some(isRemoteUrl)) {
      ctx.addIssue({ code: "custom", message: AMBIGUOUS_TARGET_MESSAGE });
      return;
    }

    if (urls.some(isRemoteUrl) && !env.tursoAuthToken) {
      ctx.addIssue({ code: "custom", message: MISSING_TOKEN_MESSAGE });
    }
  });

/**
 * El discriminante lleva la invariante: Turso siempre lleva token y el fichero
 * local nunca. Así el invariante no depende de un `!` en el código de abajo.
 */
const configSchema = z.discriminatedUnion("driver", [
  z.object({
    driver: z.literal("turso"),
    url: z.string().trim().min(1),
    authToken: z.string().trim().min(1),
  }),
  z.object({
    driver: z.literal("local-file"),
    url: z.string().trim().min(1),
    authToken: z.null(),
  }),
]);

export type DatabaseEnv = {
  DATABASE_URL?: string;
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
};

/**
 * Resuelve la configuración de la base de datos a partir de un entorno.
 *
 * Precedencia de la URL (D2): `DATABASE_URL`, `TURSO_DATABASE_URL`, y por
 * último el fichero local. `DATABASE_URL` va primero porque es la variable que
 * ya consume `prisma migrate` en local, de modo que quien tenga un `.env`
 * funcional no ve ningún cambio de comportamiento.
 *
 * @throws {DatabaseConfigError} si el entorno es incoherente.
 */
export function resolveDatabaseConfig(env: DatabaseEnv): DatabaseConfig {
  const parsedEnv = envSchema.safeParse({
    databaseUrl: blankToUndefined(env.DATABASE_URL),
    tursoDatabaseUrl: blankToUndefined(env.TURSO_DATABASE_URL),
    tursoAuthToken: blankToUndefined(env.TURSO_AUTH_TOKEN),
  });

  if (!parsedEnv.success) {
    throw new DatabaseConfigError(parsedEnv.error.issues[0]?.message ?? FALLBACK_MESSAGE);
  }

  const { databaseUrl, tursoDatabaseUrl, tursoAuthToken } = parsedEnv.data;
  const url = databaseUrl ?? tursoDatabaseUrl ?? DEFAULT_DATABASE_URL;

  // Un token sobrante sin URL de Turso no es un error: se ignora en lugar de
  // fallar, para no romper entornos locales que tengan la variable puesta.
  return configSchema.parse(
    isRemoteUrl(url)
      ? { driver: "turso", url, authToken: tursoAuthToken }
      : { driver: "local-file", url, authToken: null },
  );
}
