import { z } from "zod";

/**
 * Estados del ciclo de vida de una solicitud.
 *
 * Se persisten como `String` porque SQLite no aplica restricciones de tipo
 * (design.md D2). La validez la garantizan este módulo y el DAL, nunca la
 * base de datos.
 */
export const requestStatuses = [
  "NEW",
  "IN_REVIEW",
  "ACCEPTED",
  "REJECTED",
] as const;

export type RequestStatus = (typeof requestStatuses)[number];

export const requestStatusSchema = z.enum(requestStatuses);

export const requestStatusLabels: Record<RequestStatus, string> = {
  NEW: "Nueva",
  IN_REVIEW: "En revisión",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
};

export const requestStatusDescriptions: Record<RequestStatus, string> = {
  NEW: "Recibida y pendiente de revisar.",
  IN_REVIEW: "En proceso de comprobación.",
  ACCEPTED: "Procesada y cerrada como aceptada.",
  REJECTED: "Cerrada como rechazada.",
};

/**
 * Transiciones permitidas (design.md D6).
 *
 * `NEW -> ACCEPTED` no está permitida a propósito: ninguna solicitud se acepta
 * sin pasar por revisión. `ACCEPTED` y `REJECTED` solo se reabren hacia
 * `IN_REVIEW`.
 */
export const allowedTransitions: Record<RequestStatus, readonly RequestStatus[]> =
  {
    NEW: ["IN_REVIEW", "REJECTED"],
    IN_REVIEW: ["ACCEPTED", "REJECTED"],
    ACCEPTED: ["IN_REVIEW"],
    REJECTED: ["IN_REVIEW"],
  };

export const DEFAULT_REQUEST_STATUS: RequestStatus = "NEW";

export function isRequestStatus(value: unknown): value is RequestStatus {
  return requestStatusSchema.safeParse(value).success;
}

/** Convierte un valor desconocido de la base de datos en un estado válido. */
export function toRequestStatus(value: unknown): RequestStatus | null {
  const parsed = requestStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function canTransition(
  from: RequestStatus,
  to: RequestStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

/** Estados alcanzables desde el actual, para poblar el selector del panel. */
export function nextStatuses(from: RequestStatus): readonly RequestStatus[] {
  return allowedTransitions[from];
}

export function statusLabel(status: RequestStatus): string {
  return requestStatusLabels[status];
}
