-- CreateTable
CREATE TABLE "signature_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "nif" TEXT NOT NULL,
    "address" TEXT,
    "position" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "certificateType" TEXT NOT NULL,
    "message" TEXT,
    "privacyConsent" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "adminNotes" TEXT,
    "notificationSentAt" DATETIME,
    "notificationError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "request_status_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "request_status_events_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "signature_requests" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "signature_requests_status_createdAt_idx" ON "signature_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "signature_requests_certificateType_idx" ON "signature_requests"("certificateType");

-- CreateIndex
CREATE INDEX "signature_requests_email_idx" ON "signature_requests"("email");

-- CreateIndex
CREATE INDEX "request_status_events_requestId_createdAt_idx" ON "request_status_events"("requestId", "createdAt");
