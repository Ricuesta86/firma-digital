import "server-only";

import { z } from "zod";

import { prisma } from "@/data/db";
import {
  isSignerMode,
  type Applicant,
  type RequestPayload,
} from "@/lib/validation";
import {
  DEFAULT_REQUEST_STATUS,
  canTransition,
  isRequestStatus,
  type RequestStatus,
} from "@/lib/request-status";
import { getSession } from "@/data/auth";
import type { CsvRow } from "@/lib/csv";

/**
 * Data Access Layer de las solicitudes de firma digital.
 *
 * Es el ÚNICO módulo del proyecto que habla con la base de datos de solicitudes
 * y el único que lee `process.env` de administración. Las Server Actions de
 * `app/admin/actions.ts` son finas y delegan aquí.
 *
 * Excepción deliberada: `createRequest` es el único punto de entrada público
 * (formulario de la landing) y por eso no verifica sesión.
 */

export const MAX_NOTE_LENGTH = 2000;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/* -------------------------------------------------------------------------- */
/*                                    DTOs                                    */
/* -------------------------------------------------------------------------- */

/** Una persona de la relación de solicitantes, en el orden en que se añadió. */
export type RequestApplicantDto = {
  id: string;
  fullName: string;
  idNumber: string;
  address: string;
  email: string;
  phone: string;
  position: number;
};

/** Fila del listado: solo los campos que la tabla necesita. */
export type RequestListItemDto = {
  id: string;
  fullName: string;
  email: string;
  companyName: string;
  reeupCode: string;
  signerMode: string;
  /** Contador de la relación: el listado no trae las filas (design.md D1). */
  applicantCount: number;
  status: RequestStatus;
  createdAt: Date;
};

export type RequestStatusEventDto = {
  id: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  note: string | null;
  createdAt: Date;
};

/** Ficha completa, con datos personales, notas, historial y relación. */
export type RequestDetailDto = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  personalAddress: string | null;
  personalIdNumber: string | null;
  companyName: string;
  businessName: string;
  reeupCode: string;
  address: string | null;
  signerMode: string;
  message: string | null;
  privacyConsent: boolean;
  status: RequestStatus;
  adminNotes: string | null;
  notificationSentAt: Date | null;
  notificationError: string | null;
  createdAt: Date;
  updatedAt: Date;
  applicants: RequestApplicantDto[];
  events: RequestStatusEventDto[];
};

export type RequestListDto = {
  items: RequestListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type RequestMetricsDto = {
  total: number;
  byStatus: Record<RequestStatus, number>;
  bySignerMode: Array<{ signerMode: string; count: number }>;
};

export class RequestError extends Error {
  readonly code:
    | "unauthorized"
    | "not_found"
    | "invalid_transition"
    | "invalid_input";

  constructor(
    code: RequestError["code"],
    message: string,
  ) {
    super(message);
    this.name = "RequestError";
    this.code = code;
  }
}

/* -------------------------------------------------------------------------- */
/*                              Filtros y paginación                           */
/* -------------------------------------------------------------------------- */

const pageSchema = z.coerce.number().int().min(1).catch(1);
const pageSizeSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_PAGE_SIZE)
  .catch(DEFAULT_PAGE_SIZE);
const statusFilterSchema = z
  .string()
  .optional()
  .transform((value) => (isRequestStatus(value) ? value : undefined));
const signerModeFilterSchema = z
  .string()
  .optional()
  .transform((value) => (isSignerMode(value) ? value : undefined));
const searchSchema = z
  .string()
  .max(200)
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

export type RequestFilters = {
  q?: string;
  status?: RequestStatus;
  signerMode?: string;
  page?: number;
  pageSize?: number;
};

/**
 * Normaliza los criterios de entrada. Un valor inválido se descarta en lugar de
 * propagar el error, para que una URL manipulada no rompa el panel.
 */
export function parseRequestFilters(
  input: Record<string, string | string[] | undefined> | RequestFilters,
): Required<Pick<RequestFilters, "page" | "pageSize">> &
  RequestFilters {
  const raw = input as Record<string, string | string[] | undefined>;
  const first = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  return {
    q: searchSchema.parse(first(raw.q)),
    status: statusFilterSchema.parse(first(raw.status)),
    signerMode: signerModeFilterSchema.parse(first(raw.signerMode)),
    page: pageSchema.parse(first(raw.page)),
    pageSize: pageSizeSchema.parse(first(raw.pageSize)),
  };
}

function buildWhere(filters: RequestFilters) {
  const where: Record<string, unknown> = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.signerMode) {
    where.signerMode = filters.signerMode;
  }

  if (filters.q) {
    // Búsqueda por `contains` (design.md D8). La relación de solicitantes se
    // alcanza con una subconsulta `some`, para poder encontrar la solicitud de
    // una empresa a partir del nombre de uno de sus empleados (design.md D9).
    where.OR = [
      { fullName: { contains: filters.q } },
      { email: { contains: filters.q } },
      { companyName: { contains: filters.q } },
      { businessName: { contains: filters.q } },
      { reeupCode: { contains: filters.q } },
      { applicants: { some: { fullName: { contains: filters.q } } } },
    ];
  }

  return where;
}

/* -------------------------------------------------------------------------- */
/*                                  Lecturas                                   */
/* -------------------------------------------------------------------------- */

export async function getRequests(
  input: Record<string, string | string[] | undefined> | RequestFilters = {},
): Promise<RequestListDto> {
  await requireAuthenticated();

  const filters = parseRequestFilters(input);
  const page = filters.page;
  const pageSize = filters.pageSize;
  const where = buildWhere(filters);

  const [rows, total] = await prisma.$transaction([
    prisma.signatureRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        fullName: true,
        email: true,
        companyName: true,
        reeupCode: true,
        signerMode: true,
        status: true,
        createdAt: true,
        // El listado cuenta la relación pero no la trae: son cinco campos por
        // persona y solo hacen falta en la ficha (design.md D1).
        _count: { select: { applicants: true } },
      },
    }),
    prisma.signatureRequest.count({ where }),
  ]);

  return {
    items: rows.map(toListItem),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function toListItem(row: {
  id: string;
  fullName: string;
  email: string;
  companyName: string;
  reeupCode: string;
  signerMode: string;
  status: string;
  createdAt: Date;
  _count: { applicants: number };
}): RequestListItemDto {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    companyName: row.companyName,
    reeupCode: row.reeupCode,
    signerMode: row.signerMode,
    applicantCount: row._count.applicants,
    status: isRequestStatus(row.status) ? row.status : "NEW",
    createdAt: row.createdAt,
  };
}

export async function getRequestById(
  id: string,
): Promise<RequestDetailDto | null> {
  await requireAuthenticated();

  const row = await prisma.signatureRequest.findUnique({
    where: { id },
    include: {
      events: { orderBy: { createdAt: "asc" } },
      applicants: { orderBy: { position: "asc" } },
    },
  });

  if (!row) {
    return null;
  }

  return {
    ...row,
    applicants: row.applicants.map(toApplicant),
    status: isRequestStatus(row.status) ? row.status : "NEW",
    events: row.events.map((event) => ({
      id: event.id,
      fromStatus: isRequestStatus(event.fromStatus) ? event.fromStatus : null,
      toStatus: isRequestStatus(event.toStatus) ? event.toStatus : "NEW",
      note: event.note,
      createdAt: event.createdAt,
    })),
  };
}

export async function getMetrics(): Promise<RequestMetricsDto> {
  await requireAuthenticated();

  // Lecturas de agregación independientes: la forma array de `$transaction`
  // ensancha el tipo de `_count`. Una ligera incoherencia entre los tres
  // recuentos es irrelevante para un resumen de dashboard.
  const total = await prisma.signatureRequest.count();
  const byStatusRows = await prisma.signatureRequest.groupBy({
    by: ["status"],
    _count: { _all: true },
    orderBy: { status: "asc" },
  });
  const bySignerModeRows = await prisma.signatureRequest.groupBy({
    by: ["signerMode"],
    _count: { _all: true },
    orderBy: { _count: { signerMode: "desc" } },
  });

  const byStatus = {
    NEW: 0,
    IN_REVIEW: 0,
    ACCEPTED: 0,
    REJECTED: 0,
  } satisfies Record<RequestStatus, number>;

  for (const row of byStatusRows) {
    const status = isRequestStatus(row.status) ? row.status : "NEW";
    byStatus[status] = row._count._all;
  }

  return {
    total,
    byStatus,
    bySignerMode: bySignerModeRows.map((row) => ({
      signerMode: row.signerMode,
      count: row._count._all,
    })),
  };
}

/**
 * Solicitudes para la exportación CSV. Reutiliza el mismo filtrado que el
 * listado, pero sin paginar, y selecciona únicamente las columnas del CSV:
 * las notas internas, el historial y el motivo de los fallos de notificación
 * no se exportan (design.md D9).
 */
export async function getRequestsForExport(
  input: Record<string, string | string[] | undefined> | RequestFilters = {},
): Promise<CsvRow[]> {
  await requireAuthenticated();

  const filters = parseRequestFilters(input);

  const rows = await prisma.signatureRequest.findMany({
    where: buildWhere(filters),
    orderBy: { createdAt: "desc" },
    // Una fila por solicitud: la relación de solicitantes no se exporta al CSV
    // (spec request-export).
    select: {
      id: true,
      createdAt: true,
      status: true,
      fullName: true,
      email: true,
      phone: true,
      personalAddress: true,
      personalIdNumber: true,
      companyName: true,
      businessName: true,
      reeupCode: true,
      address: true,
      signerMode: true,
      message: true,
    },
  });

  // La fecha se serializa aquí y no en el Route Handler: el DAL entrega filas
  // listas para el CSV.
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

/* -------------------------------------------------------------------------- */
/*                                 Captura                                    */
/* -------------------------------------------------------------------------- */

/**
 * Punto de entrada público: persiste una solicitud ya validada.
 * No verifica sesión porque lo invoca el formulario de la landing.
 */
export async function createRequest(payload: RequestPayload): Promise<string> {
  // La relación se crea anidada en la misma operación: o se guarda la solicitud
  // con sus solicitantes, o no se guarda nada (design.md D1 y D4).
  const created = await prisma.signatureRequest.create({
    data: {
      fullName: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      personalAddress: payload.personalAddress,
      personalIdNumber: payload.personalIdNumber,
      companyName: payload.companyName,
      businessName: payload.businessName,
      reeupCode: payload.reeupCode,
      address: payload.address,
      signerMode: payload.signerMode,
      message: payload.message,
      privacyConsent: payload.privacyConsent,
      status: DEFAULT_REQUEST_STATUS,
      applicants: {
        create: (payload.applicants ?? []).map((applicant, index) => ({
          ...toApplicantFields(applicant),
          // El índice fija el orden de alta, que el panel y el correo respetan.
          position: index,
        })),
      },
    },
    select: { id: true },
  });

  return created.id;
}

function toApplicantFields(applicant: Applicant) {
  return {
    fullName: applicant.fullName,
    idNumber: applicant.idNumber,
    address: applicant.address,
    email: applicant.email,
    phone: applicant.phone,
  };
}

function toApplicant(row: {
  id: string;
  fullName: string;
  idNumber: string;
  address: string;
  email: string;
  phone: string;
  position: number;
}): RequestApplicantDto {
  return {
    id: row.id,
    fullName: row.fullName,
    idNumber: row.idNumber,
    address: row.address,
    email: row.email,
    phone: row.phone,
    position: row.position,
  };
}

/**
 * Relación de solicitantes de una solicitud, en el orden de alta. La usa la
 * ficha de detalle y cualquier vista que necesite las filas (design.md D1).
 */
export async function getRequestApplicants(
  id: string,
): Promise<RequestApplicantDto[]> {
  await requireAuthenticated();

  const rows = await prisma.requestApplicant.findMany({
    where: { requestId: id },
    orderBy: { position: "asc" },
    select: {
      id: true,
      fullName: true,
      idNumber: true,
      address: true,
      email: true,
      phone: true,
      position: true,
    },
  });

  return rows.map(toApplicant);
}

/** Registra el resultado del aviso por correo (best-effort, design.md D7). */
export async function recordNotificationResult(
  id: string,
  result:
    | { sent: true; at?: Date }
    | { sent: false; error: string },
): Promise<void> {
  await prisma.signatureRequest.update({
    where: { id },
    data:
      result.sent
        ? { notificationSentAt: result.at ?? new Date(), notificationError: null }
        : { notificationSentAt: null, notificationError: result.error },
  });
}

/* -------------------------------------------------------------------------- */
/*                                 Mutaciones                                  */
/* -------------------------------------------------------------------------- */

export async function updateRequestStatus(
  id: string,
  to: unknown,
  note?: string,
): Promise<RequestStatus> {
  await requireAuthenticated();

  if (!isRequestStatus(to)) {
    throw new RequestError(
      "invalid_input",
      "El estado indicado no es válido.",
    );
  }

  const request = await prisma.signatureRequest.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!request) {
    throw new RequestError(
      "not_found",
      "La solicitud no existe.",
    );
  }

  const from = isRequestStatus(request.status) ? request.status : "NEW";

  if (from === to) {
    throw new RequestError(
      "invalid_transition",
      `La solicitud ya está en estado «${to}».`,
    );
  }

  if (!canTransition(from, to)) {
    throw new RequestError(
      "invalid_transition",
      `No se puede pasar de «${from}» a «${to}».`,
    );
  }

  // Estado e historial se escriben en la misma transacción: si el evento falla,
  // el estado tampoco cambia.
  await prisma.$transaction([
    prisma.signatureRequest.update({
      where: { id },
      data: { status: to },
    }),
    prisma.requestStatusEvent.create({
      data: {
        requestId: id,
        fromStatus: from,
        toStatus: to,
        note: note?.trim() || null,
      },
    }),
  ]);

  return to;
}

const noteSchema = z.string().trim().min(1).max(MAX_NOTE_LENGTH);

export async function addInternalNote(id: string, text: unknown): Promise<void> {
  await requireAuthenticated();

  const parsed = noteSchema.safeParse(text);
  if (!parsed.success) {
    throw new RequestError(
      "invalid_input",
      parsed.error.issues[0]?.message ?? "La nota no es válida.",
    );
  }

  const request = await prisma.signatureRequest.findUnique({
    where: { id },
    select: { id: true, adminNotes: true },
  });

  if (!request) {
    throw new RequestError("not_found", "La solicitud no existe.");
  }

  // Las notas se acumulan; nunca se pisan entre sí.
  const merged = request.adminNotes
    ? `${request.adminNotes}\n${parsed.data}`
    : parsed.data;

  await prisma.signatureRequest.update({
    where: { id },
    data: { adminNotes: merged },
  });
}

/* -------------------------------------------------------------------------- */
/*                               Autorización                                 */
/* -------------------------------------------------------------------------- */

/**
 * Verificación de sesión para el DAL. Lanza en lugar de redirigir, porque quien
 * la llama es una acción de servidor o un endpoint, no una página.
 */
async function requireAuthenticated(): Promise<void> {
  const session = await getSession();
  if (!session) {
    throw new RequestError("unauthorized", "No autorizado.");
  }
}
