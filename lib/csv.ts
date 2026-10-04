/**
 * Generación del CSV de solicitudes.
 *
 * Vive fuera de `data/requests.ts` a propósito: es serialización de una
 * descarga, no acceso a datos. No se exporta a ningún componente de cliente.
 */

export const CSV_COLUMNS = [
  "id",
  "createdAt",
  "status",
  "signerMode",
  "fullName",
  "email",
  "phone",
  "personalAddress",
  "personalIdNumber",
  "companyName",
  "businessName",
  "reeupCode",
  "address",
  "message",
] as const;

export type CsvRow = Record<string, string | null | undefined>;

/** Cabecera legible, en el mismo orden que `CSV_COLUMNS`. */
const CSV_HEADERS: Record<(typeof CSV_COLUMNS)[number], string> = {
  id: "ID",
  createdAt: "Fecha",
  status: "Estado",
  signerMode: "Modo de firmante",
  fullName: "Nombre completo",
  email: "Email",
  phone: "Teléfono",
  personalAddress: "Dirección",
  personalIdNumber: "Número de carnet de identidad",
  companyName: "Razón social",
  businessName: "Nombre de la empresa",
  reeupCode: "Código REEUP",
  address: "Dirección de la empresa",
  message: "Mensaje",
};

/**
 * Neutraliza los valores que una hoja de cálculo interpretaría como fórmula.
 *
 * Se antepone un apóstrofo, que Excel y LibreOffice tratan como marca de
 * texto: el usuario ve el valor original y no se ejecuta. Se hace también en la
 * cabecera de línea, para un valor que empiece por tabulador o salto de línea.
 */
export function sanitizeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** Escapa comas, comillas dobles y saltos de línea (RFC 4180). */
export function escapeCell(value: string): string {
  const sanitized = sanitizeCell(value);
  if (/[",\n\r]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

function formatValue(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  return escapeCell(value);
}

/**
 * Genera el CSV completo, con BOM UTF-8 al principio para que la hoja de cálculo
 * respete acentos y la letra ñ.
 */
export function buildCsv(rows: CsvRow[]): string {
  const header = CSV_COLUMNS.map((column) => CSV_HEADERS[column]).join(",");
  const lines = rows.map((row) =>
    CSV_COLUMNS.map((column) => formatValue(row[column])).join(","),
  );

  return `﻿${[header, ...lines].join("\r\n")}\r\n`;
}

/** Nombre de fichero con la fecha de generación. */
export function buildCsvFilename(now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `solicitudes-firma-digital-${stamp}.csv`;
}
