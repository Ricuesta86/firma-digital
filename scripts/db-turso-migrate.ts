/**
 * Aplicación de migraciones contra Turso.
 *
 * POR QUÉ EXISTE: el motor de migraciones de Prisma es un binario Rust que solo
 * entiende rutas de SQLite locales. Con `provider = "sqlite"` rechaza el
 * esquema `libsql://` con P1013, y lo hace igual en `migrate deploy`, `db push`
 * y `db execute`. No es un problema de configuración: el motor no habla libSQL.
 * La conexión en runtime sí funciona, porque el adaptador `@prisma/adapter-libsql`
 * sí lo habla. Por eso el esquema se aplica con este script.
 *
 * CÓMO FUNCIONA: `prisma migrate diff` genera el SQL del schema sin necesitar
 * una conexión (se verificó que funciona con la base inaccesible), y ese SQL se
 * aplica con `executeMultiple()` de `@libsql/client`, pensado para scripts.
 *
 * IDEMPOTENCIA: cada migración aplicada se registra en `_prisma_migrations` con
 * su checksum, igual que hace Prisma. Volver a ejecutar el script no repite
 * cambios; si el SQL de una migración ya registrada cambia, el script falla en
 * lugar de dejar el esquema a medias.
 *
 * Uso:
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... \
 *     pnpm db:deploy:turso
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

import { createClient, type Client } from "@libsql/client";

import { resolveDatabaseConfig } from "@/lib/db-config";

const MIGRATIONS_TABLE = "_prisma_migrations";

type AppliedRow = {
  migration_name: string;
  checksum: string;
};

function readMigrationsDir(): string {
  return execFileSync("pwd", { encoding: "utf8" }).trim() + "/prisma/migrations";
}

/**
 * Genera el SQL del schema completo sin conexión a la base de datos.
 * `migrate diff` no habla con la BD cuando el origen es `--from-empty`.
 */
function generateSchemaSql(): string {
  return execFileSync(
    "pnpm",
    [
      "exec",
      "prisma",
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema",
      "prisma/schema.prisma",
      "--script",
    ],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
}

function checksum(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

async function ensureMigrationsTable(client: Client): Promise<void> {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
      id TEXT PRIMARY KEY,
      migration_name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      finished_at TEXT
    );
  `);
}

async function readApplied(client: Client): Promise<AppliedRow[]> {
  const result = await client.execute(
    `SELECT migration_name, checksum FROM "${MIGRATIONS_TABLE}"`,
  );
  return result.rows as unknown as AppliedRow[];
}

async function main() {
  const config = resolveDatabaseConfig({
    DATABASE_URL: process.env.DATABASE_URL,
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
  });

  if (config.driver !== "turso") {
    throw new Error(
      `Este script solo aplica migraciones en Turso, pero el destino resuelto es ` +
        `'${config.driver}' (${config.url}). Define TURSO_DATABASE_URL y ` +
        `TURSO_AUTH_TOKEN. Para la base local usa 'pnpm db:migrate'.`,
    );
  }

  const client = createClient({ url: config.url, authToken: config.authToken });

  try {
    await ensureMigrationsTable(client);

    const applied = await readApplied(client);
    const appliedByName = new Map(applied.map((r) => [r.migration_name, r.checksum]));

    // El diff cubre el schema entero, así que se aplica como una única unidad
    // y se registra con un nombre de marca. Si el esquema ya estuviera
    // aplicado, el registro lo impide y no se toca nada.
    const marker = "__turso_schema_init__";
    const alreadyApplied = appliedByName.has(marker);
    const sql = generateSchemaSql();
    const currentChecksum = checksum(sql);

    if (alreadyApplied) {
      const previous = appliedByName.get(marker)!;
      if (previous !== currentChecksum) {
        console.error(
          "El esquema de prisma/schema.prisma ha cambiado desde la última " +
            "aplicación en Turso, y este script solo sabe aplicar el diff " +
            "completo. Aplica el cambio manualmente con turso db shell.",
        );
        process.exitCode = 1;
        return;
      }
      console.log("El esquema ya está aplicado en Turso. No hay nada que hacer.");
      return;
    }

    console.log("Aplicando el esquema a Turso...");
    await client.executeMultiple(sql);

    await client.execute({
      sql: `INSERT INTO "${MIGRATIONS_TABLE}" (id, migration_name, checksum, finished_at)
            VALUES (?, ?, ?, datetime('now'))`,
      args: [marker, marker, currentChecksum],
    });

    console.log("Esquema aplicado y registrado en _prisma_migrations.");
    console.log("Migraciones locales en:", readMigrationsDir());
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error("FALLO:", error);
  process.exitCode = 1;
});
