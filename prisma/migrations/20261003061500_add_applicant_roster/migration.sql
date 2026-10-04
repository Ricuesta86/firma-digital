-- RedefineTable
--
-- La tabla se reconstruye porque SQLite rechaza `DROP COLUMN` sobre columnas
-- `NOT NULL` sin valor por defecto, que es el caso de `position`, `documentType`,
-- `documentNumber`, `country` y `certificateType`. Es una migración DESTRUCTIVA:
-- las solicitudes ya registradas pierden cargo, tipo y número de documento y
-- país de residencia (design.md D2).
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_signature_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "personalAddress" TEXT,
    "personalIdNumber" TEXT,
    "companyName" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "reeupCode" TEXT NOT NULL,
    "address" TEXT,
    "signerMode" TEXT NOT NULL DEFAULT 'personal',
    "message" TEXT,
    "privacyConsent" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "adminNotes" TEXT,
    "notificationSentAt" DATETIME,
    "notificationError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- `nif` se copia a `reeupCode` sin transformar, de modo que los identificadores ya
-- registrados se conservan. `businessName` es obligatoria y no admite valor por
-- defecto: para el histórico se replica la razón social, que es el único dato
-- equivalente disponible. Las solicitudes anteriores a este cambio son de un
-- único firmante, así que `signerMode` se fija en 'personal'.
INSERT INTO "new_signature_requests" (
    "id",
    "fullName",
    "email",
    "phone",
    "personalAddress",
    "personalIdNumber",
    "companyName",
    "businessName",
    "reeupCode",
    "address",
    "signerMode",
    "message",
    "privacyConsent",
    "status",
    "adminNotes",
    "notificationSentAt",
    "notificationError",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "fullName",
    "email",
    "phone",
    NULL,
    NULL,
    "companyName",
    "companyName",
    "nif",
    "address",
    'personal',
    "message",
    "privacyConsent",
    "status",
    "adminNotes",
    "notificationSentAt",
    "notificationError",
    "createdAt",
    "updatedAt"
FROM "signature_requests";

DROP TABLE "signature_requests";

ALTER TABLE "new_signature_requests" RENAME TO "signature_requests";

-- CreateTable
CREATE TABLE "request_applicants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "request_applicants_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "signature_requests" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "signature_requests_status_createdAt_idx" ON "signature_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "signature_requests_signerMode_idx" ON "signature_requests"("signerMode");

-- CreateIndex
CREATE INDEX "signature_requests_email_idx" ON "signature_requests"("email");

-- CreateIndex
CREATE INDEX "request_applicants_requestId_idx" ON "request_applicants"("requestId");

PRAGMA foreign_keys=ON;
