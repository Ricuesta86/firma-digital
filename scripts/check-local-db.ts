/**
 * Comprobación del destino SQLite local.
 *
 * Replica la construcción de `data/db.ts` (misma versión pura, con la misma
 * config y el mismo adaptador) porque `data/db.ts` importa `server-only` y no
 * se puede cargar fuera de un bundle de servidor de React. Ejercita el cliente
 * de Prisma real, el adaptador real y el fichero real, con una escritura, una
 * lectura y un borrado.
 *
 * Uso: pnpm exec tsx scripts/check-local-db.ts
 */

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/lib/generated/prisma/client";
import { resolveDatabaseConfig } from "@/lib/db-config";

async function main() {
  // Sin variables de Turso: debe caer al fichero local por defecto.
  const config = resolveDatabaseConfig({
    DATABASE_URL: process.env.DATABASE_URL,
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
  });

  if (config.driver !== "local-file") {
    throw new Error(
      `Se esperaba el destino local y se resolvió '${config.driver}' (${config.url})`,
    );
  }
  console.log("URL resuelta:", config.url, "| driver:", config.driver);

  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: config.url }) });
  const marker = `probe-${Date.now()}`;

  try {
    const created = await prisma.signatureRequest.create({
      data: {
        fullName: "Prueba de conexion",
        email: "probe@example.com",
        phone: "600000000",
        companyName: "Sonda S.L.",
        businessName: "Sonda",
        reeupCode: "B00000000",
        signerMode: "personal",
        personalIdNumber: "00000000T",
        privacyConsent: true,
        message: marker,
      },
      select: { id: true },
    });

    const found = await prisma.signatureRequest.findUnique({
      where: { id: created.id },
      select: { message: true, status: true },
    });

    const readOk = found?.message === marker;
    console.log(`escritura + lectura: ${readOk ? "OK" : "FALLO"}`, found);

    await prisma.signatureRequest.delete({ where: { id: created.id } });

    const gone = await prisma.signatureRequest.count({ where: { id: created.id } });
    const deleteOk = gone === 0;
    console.log(`borrado de la sonda: ${deleteOk ? "OK" : "FALLO"}`);

    if (!readOk || !deleteOk) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("FALLO:", error);
  process.exitCode = 1;
});
