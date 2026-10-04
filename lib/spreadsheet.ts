import { Readable } from "node:stream";

import { sanitizeCell } from "@/lib/csv";
import {
  applicantSchema,
  MAX_APPLICANTS,
  MAX_UPLOAD_BYTES,
  type Applicant,
} from "@/lib/validation";

/**
 * Hoja de cálculo de la relación de solicitantes.
 *
 * Vive fuera de `data/requests.ts` porque es serialización, no acceso a datos, y
 * fuera del bundle del cliente: `exceljs` solo se importa dinámicamente y solo en
 * las rutas que importan o exportan la relación (design.md D5).
 *
 * El mismo libro sirve para la descarga del modal y para el adjunto del correo
 * de aviso, de modo que ambos ficheros son idénticos (design.md D7).
 */

type Workbook = import("exceljs").Workbook;

/** Las cinco columnas, en el orden en que se escriben y se leen. */
export const ROSTER_COLUMNS = [
  { key: "fullName", header: "Nombre y apellidos" },
  { key: "idNumber", header: "Número de carnet de identidad" },
  { key: "address", header: "Dirección" },
  { key: "email", header: "Correo electrónico" },
  { key: "phone", header: "Número del móvil" },
] as const;

type RosterColumnKey = (typeof ROSTER_COLUMNS)[number]["key"];

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Sinónimos admitidos por columna al importar. La comparación se normaliza
 * (minúsculas, sin acentos y sin signos), así que «Nº carnet», «número de
 * carnet de identidad» o «DNI» apuntan a la misma columna.
 */
const HEADER_ALIASES: Record<RosterColumnKey, string[]> = {
  fullName: ["nombre y apellidos", "nombre y apellido", "nombre completo", "nombre"],
  idNumber: [
    "numero de carnet de identidad",
    "numero carnet de identidad",
    "carnet de identidad",
    "numero de carnet",
    "n carnet",
    "dni",
    "idnumber",
  ],
  address: ["direccion", "address"],
  email: ["correo electronico", "correo", "email", "correoelectronico"],
  phone: [
    "numero del movil",
    "numero de movil",
    "movil",
    "telefono",
    "numero de telefono",
    "phone",
  ],
};

export type RosterRowError = {
  /** Número de fila tal como se ve en la hoja: la cabecera es la fila 1. */
  fila: number;
  campo?: RosterColumnKey;
  mensaje: string;
};

export type RosterParseResult = {
  filas: Applicant[];
  errores: RosterRowError[];
};

/** Motivo por el que se rechaza un fichero entero, no una fila. */
export type RosterRejectionReason =
  | "formato"
  | "tamaño"
  | "cabecera"
  | "limite"
  | "contenido";

export class RosterFileError extends Error {
  readonly reason: RosterRejectionReason;
  readonly detalle: string[];

  constructor(reason: RosterRejectionReason, message: string, detalle: string[] = []) {
    super(message);
    this.name = "RosterFileError";
    this.reason = reason;
    this.detalle = detalle;
  }
}

/**
 * Carga `exceljs` bajo demanda. El import es dinámico a propósito: el coste se
 * paga solo en las peticiones que importan o exportan, no al arrancar el
 * servidor (design.md D5).
 */
async function loadExcelJs(): Promise<typeof import("exceljs")> {
  const exceljsModule = await import("exceljs");
  return exceljsModule.default
    ? { ...exceljsModule, ...exceljsModule.default }
    : exceljsModule;
}

function newWorkbook(ExcelJs: typeof import("exceljs")): Workbook {
  return new ExcelJs.Workbook();
}

/**
 * El texto que se escribe en una celda. Se neutraliza con `sanitizeCell` de
 * `lib/csv.ts`: una celda de texto que empieza por `=`, `+`, `-` o `@` se
 * convierte en fórmula al abrirla, también en xlsx (design.md D6).
 */
function cellText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    // exceljs devuelve objetos para fórmulas, hipervínculos y texto enriquecido.
    const rich = value as {
      text?: string;
      richText?: Array<{ text?: string }>;
      formula?: string;
      result?: unknown;
    };

    if (Array.isArray(rich.richText)) {
      return sanitizeCell(rich.richText.map((part) => part.text ?? "").join(""));
    }
    if (typeof rich.text === "string") {
      return sanitizeCell(rich.text);
    }
    if (typeof rich.formula === "string") {
      return sanitizeCell(rich.result === undefined ? "" : String(rich.result));
    }
  }

  return sanitizeCell(String(value));
}

/** Nombre de fichero con la fecha de generación: `solicitantes-<marca>.xlsx`. */
export function buildRosterFilename(now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `solicitantes-${stamp}.xlsx`;
}

export function rosterContentType(): string {
  return XLSX_CONTENT_TYPE;
}

/**
 * Genera el libro de la relación. Fila de cabecera con los cinco datos y una fila
 * por persona, en el orden en que se añadieron.
 */
export async function buildRosterWorkbook(
  applicants: readonly Pick<
    Applicant,
    "fullName" | "idNumber" | "address" | "email" | "phone"
  >[],
): Promise<Buffer> {
  const ExcelJs = await loadExcelJs();
  const workbook = newWorkbook(ExcelJs);
  const sheet = workbook.addWorksheet("Solicitantes");

  sheet.addRow(ROSTER_COLUMNS.map((column) => column.header));
  for (const applicant of applicants) {
    sheet.addRow(ROSTER_COLUMNS.map((column) => cellText(applicant[column.key])));
  }

  const written = await workbook.xlsx.writeBuffer();
  return Buffer.from(written as ArrayBuffer);
}

/** Quita el BOM UTF-8 que algunas hojas añaden al principio del CSV. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Minúsculas, sin acentos y sin signos, para comparar cabeceras. */
function normalizeHeader(value: string): string {
  return stripBom(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u00f1 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lee la relación de un `.xlsx` o un `.csv`.
 *
 * No persiste nada: devuelve las filas ya validadas y los errores por número de
 * fila, para que quien llama decida qué hacer con ellas (design.md D5).
 */
export async function parseRosterWorkbook(
  buffer: Buffer,
  filename: string,
): Promise<RosterParseResult> {
  const lower = filename.toLowerCase();

  if (!lower.endsWith(".xlsx") && !lower.endsWith(".csv")) {
    throw new RosterFileError(
      "formato",
      "Formato no admitido: sube un fichero .xlsx o .csv.",
    );
  }

  // El tope se comprueba antes de leer: un xlsx manipulado puede pedir mucha
  // memoria al descomprimirse (design.md, riesgos).
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new RosterFileError(
      "tamaño",
      `El fichero supera el tamaño máximo admitido (${Math.floor(
        MAX_UPLOAD_BYTES / (1024 * 1024),
      )} MB).`,
    );
  }

  const ExcelJs = await loadExcelJs();
  const workbook = newWorkbook(ExcelJs);

  if (lower.endsWith(".csv")) {
    // ExcelJS lee CSV como flujo, no como Buffer: se envuelve en un Readable.
    await workbook.csv.read(Readable.from(buffer));
  } else {
    try {
      // El `Buffer` que espera ExcelJS viene de su propia copia de los tipos de
      // Node, así que no es asignable al de este proyecto: se pasa el tipo que
      // la propia firma declara en lugar de forzar con `any`.
      await workbook.xlsx.load(
        buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
      );
    } catch {
      throw new RosterFileError(
        "contenido",
        "No se ha podido leer el fichero .xlsx. Comprueba que no esté dañado.",
      );
    }
  }

  const sheet = workbook.worksheets[0];

  if (!sheet) {
    throw new RosterFileError(
      "cabecera",
      "El fichero no contiene ninguna hoja de cálculo con datos.",
    );
  }

  const headerRow = sheet.getRow(1);
  const mapping = new Map<RosterColumnKey, number>();
  const seenHeaders = new Set<string>();

  headerRow.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
    const text = normalizeHeader(cellRawText(cell.value));
    seenHeaders.add(text);

    for (const key of Object.keys(HEADER_ALIASES) as RosterColumnKey[]) {
      if (mapping.has(key)) {
        continue;
      }
      if (HEADER_ALIASES[key].includes(text)) {
        mapping.set(key, columnNumber);
        return;
      }
    }
  });

  const missing = (Object.keys(HEADER_ALIASES) as RosterColumnKey[]).filter(
    (key) => !mapping.has(key),
  );

  if (missing.length > 0) {
    throw new RosterFileError(
      "cabecera",
      "La cabecera del fichero no contiene todas las columnas obligatorias.",
      missing.map((key) => ROSTER_COLUMNS.find((c) => c.key === key)?.header ?? key),
    );
  }

  const filas: Applicant[] = [];
  const errores: RosterRowError[] = [];
  const dataRowCount = sheet.rowCount - 1;

  if (dataRowCount > MAX_APPLICANTS) {
    throw new RosterFileError(
      "limite",
      `El fichero contiene ${dataRowCount} filas y el máximo es ${MAX_APPLICANTS}.`,
    );
  }

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);

    const read = (key: RosterColumnKey) => {
      const column = mapping.get(key) as number;
      const value = row.getCell(column).value;
      // Al importar se lee el valor tal cual: `sanitizeCell` solo se aplica al
      // generar ficheros, no al leerlos.
      return cellRawText(value);
    };

    const candidate = {
      fullName: read("fullName"),
      idNumber: read("idNumber"),
      address: read("address"),
      email: read("email"),
      phone: read("phone"),
    };

    const algunaDato = Object.values(candidate).some((value) => value.length > 0);

    if (!algunaDato) {
      continue;
    }

    const parsed = applicantSchema.safeParse(candidate);

    if (parsed.success) {
      filas.push(parsed.data);
      continue;
    }

    for (const issue of parsed.error.issues) {
      errores.push({
        fila: rowNumber,
        campo: issue.path[0] as RosterColumnKey,
        mensaje: issue.message,
      });
    }
  }

  return { filas, errores };
}

/** Texto crudo de una celda, sin neutralizar: al leer no se inventa nada. */
function cellRawText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    const rich = value as {
      text?: string;
      richText?: Array<{ text?: string }>;
      formula?: string;
      result?: unknown;
    };

    if (Array.isArray(rich.richText)) {
      return rich.richText.map((part) => part.text ?? "").join("").trim();
    }
    if (typeof rich.text === "string") {
      return rich.text.trim();
    }
    if (typeof rich.formula === "string") {
      return rich.result === undefined ? "" : String(rich.result).trim();
    }
  }

  return String(value).trim();
}
