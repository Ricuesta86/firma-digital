/**
 * Comprobación del destino Turso: escribe, lee y borra una solicitud real
 * contra la base de datos de Turso usando el cliente de Prisma y el adaptador
 * de libSQL (`PrismaLibSql`), igual que hace `data/db.ts`.
 *
 * Las credenciales vienen del entorno; el script no las escribe en disco.
 * No usa `data/db.ts` porque ese módulo importa `server-only` y no se puede
 * cargar fuera de un bundle de servidor de React.
 *
 * Uso:
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... \
 *     pnpm exec tsx scripts/check-turso-db.ts
 */

import { PrismaLibSql } from "@prisma/adapter-libsql";

import { PrismaClient } from "@/lib/generated/prisma/client";
import { resolveDatabaseConfig } from "@/lib/db-config";

async function main() {
  const config = resolveDatabaseConfig({
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
  });

  if (config.driver !== "turso") {
    throw new Error(`Se esperaba el destino Turso y se resolvió '${config.driver}'`);
  }
  console.log("URL resuelta:", config.url, "| driver:", config.driver);
  console.log("token fuera de la URL:", !config.url.includes(config.authToken));

  const prisma = new PrismaClient({
    adapter: new PrismaLibSql({ url: config.url, authToken: config.authToken }),
  });
  const marker = `probe-turso-${Date.now()}`;

  try {
    const created = await prisma.signatureRequest.create({
      data: {
        fullName: "Prueba de conexion Turso",
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
    console.log("escritura: OK", created.id);

    const found = await prisma.signatureRequest.findUnique({
      where: { id: created.id },
      select: { message: true, status: true, createdAt: true },
    });
    const readOk = found?.message === marker;
    console.log(`lectura: ${readOk ? "OK" : "FALLO"}`, found);

    // Confirma que lo escrito es visible desde una conexión nueva, es decir que
    // hay salida del proceso y no una caché local del adaptador.
    await prisma.$disconnect();
    const prisma2 = new PrismaClient({
      adapter: new PrismaLibSql({ url: config.url, authToken: config.authToken }),
    });
    const reread = await prisma2.signatureRequest.findUnique({
      where: { id: created.id },
      select: { message: true },
    });
    const remoteOk = reread?.message === marker;
    console.log(`relectura desde conexión nueva: ${remoteOk ? "OK" : "FALLO"}`);
    await prisma2.signatureRequest.delete({ where: { id: created.id } });

    const gone = await prisma2.signatureRequest.count({ where: { id: created.id } });
    console.log(`borrado: ${gone === 0 ? "OK" : "FALLO"}`);

    if (!readOk || !remoteOk || gone !== 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("FALLO:", error);
  process.exitCode = 1;
});
