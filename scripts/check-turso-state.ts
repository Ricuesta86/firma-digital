/**
 * Estado final de la base de datos de Turso: tablas, índices y número de
 * filas. Solo lectura.
 *
 * Uso:
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... \
 *     pnpm exec tsx scripts/check-turso-state.ts
 */

import { createClient } from "@libsql/client";

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  try {
    const tables = await client.execute(
      `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
    );
    const indexes = await client.execute(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    );

    console.log("tablas:", tables.rows.map((r) => r.name).join(", "));
    console.log("índices:", indexes.rows.map((r) => r.name).join(", "));

    for (const table of ["signature_requests", "request_status_events"]) {
      const { rows } = await client.execute(`SELECT COUNT(*) AS n FROM "${table}"`);
      console.log(`filas en ${table}:`, rows[0]?.n);
    }
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error("FALLO:", error);
  process.exitCode = 1;
});
