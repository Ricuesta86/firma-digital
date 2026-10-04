"use server";

import { z } from "zod";

import { sendRequestEmail } from "@/lib/email";
import {
  requestSchema,
  type Applicant,
  type RequestPayload,
} from "@/lib/validation";
import { createRequest, recordNotificationResult } from "@/data/requests";

export type RequestState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /**
   * Relación rehidratada tras un error de validación, para que el modal
   * vuelva a mostrar lo que el visitante ya había tecleado (design.md D4).
   */
  applicants?: Applicant[];
  signerMode?: RequestPayload["signerMode"];
};

function flattenIssues(
  error: import("zod").ZodError,
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    // La ruta completa, no solo su primer elemento: los errores de un
    // solicitante llegan como `applicants.3.email` y el modal los pinta en la fila
    // que los originó (design.md D4).
    const key = issue.path.length > 0 ? issue.path.join(".") : "form";
    (fieldErrors[key] ??= []).push(issue.message);
  }

  return fieldErrors;
}

const SUCCESS_MESSAGE =
  "¡Solicitud enviada! Te contactaremos con los siguientes pasos para la emisión de tu firma digital.";

/**
 * La relación viaja en un único campo oculto con JSON. Un array vacío se
 * normaliza a `undefined`: así el esquema discrimina sin que un formulario en
 * modo «Personal» tenga que omitir el campo.
 */
const applicantsJsonSchema = z.array(z.unknown());

function parseApplicants(raw: FormDataEntryValue | null): {
  applicants?: Applicant[];
  malformed: boolean;
} {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { malformed: false };
  }

  try {
    const parsedJson = applicantsJsonSchema.parse(JSON.parse(raw));

    // Se filtran las entradas no-objeto: el array definitivo lo valida
    // `requestSchema`, fila a fila, con mensajes por su ruta.
    return {
      applicants: parsedJson.filter(
        (entry): entry is Applicant =>
          typeof entry === "object" && entry !== null && !Array.isArray(entry),
      ),
      malformed: false,
    };
  } catch {
    return { malformed: true };
  }
}

export async function requestSignature(
  _prevState: RequestState,
  formData: FormData,
): Promise<RequestState> {
  const { applicants, malformed } = parseApplicants(formData.get("applicants"));

  const raw = {
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    signerMode: formData.get("signerMode"),
    // Campos opcionales: si el cliente no los envía, `FormData.get` devuelve
    // `null` y el schema (que espera `undefined`) los rechazaría.
    personalAddress: formData.get("personalAddress") ?? undefined,
    personalIdNumber: formData.get("personalIdNumber") ?? undefined,
    companyName: formData.get("companyName"),
    businessName: formData.get("businessName"),
    reeupCode: formData.get("reeupCode"),
    address: formData.get("address") ?? undefined,
    message: formData.get("message") ?? undefined,
    privacyConsent: formData.get("privacyConsent") === "on",
    applicants:
      applicants && applicants.length > 0 ? applicants : undefined,
  };

  // Un JSON malformado no lanza: se devuelve como error de validación del
  // formulario, que es donde el visitante puede corregirlo.
  if (malformed) {
    return {
      status: "error",
      message: "Revisa los campos marcados e inténtalo de nuevo.",
      fieldErrors: {
        applicants: [
          "No se ha podido leer la relación de solicitantes. Vuelve a cargarla.",
        ],
      },
      applicants,
      signerMode: raw.signerMode === "multiple" ? "multiple" : "personal",
    };
  }

  const parsed = requestSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisa los campos marcados e inténtalo de nuevo.",
      fieldErrors: flattenIssues(parsed.error),
      // La relación y el modo vuelven en el estado para que el modal se
      // rehidrate en lugar de presentarse vacío (design.md D4).
      applicants,
      signerMode:
        raw.signerMode === "multiple" ? "multiple" : "personal",
    };
  }

  // Orden deliberado (design.md D7): la persistencia es la fuente de verdad y
  // va primero. El correo es un aviso best-effort posterior.
  let requestId: string;
  try {
    requestId = await createRequest(parsed.data);
  } catch (error) {
    console.error("Error al guardar la solicitud:", error);
    return {
      status: "error",
      message:
        "No se pudo registrar la solicitud en este momento. Inténtalo de nuevo en unos minutos.",
    };
  }

  try {
    // Incluye la generación y el envío del adjunto en modo «varias personas»:
    // cualquier fallo aquí cae en este mismo `catch` best-effort y no en uno
    // aparte (design.md D7).
    await sendRequestEmail(parsed.data);
    await recordNotificationResult(requestId, { sent: true });
  } catch (error) {
    // La solicitud YA está guardada: un fallo de SMTP no la pierde. Se registra
    // el motivo para que el panel lo muestre y el visitante recibe el mismo
    // mensaje de éxito que si todo hubiera ido bien.
    const reason = error instanceof Error ? error.message : String(error);
    console.error("Error al enviar el correo de aviso:", error);
    try {
      await recordNotificationResult(requestId, { sent: false, error: reason });
    } catch (recordError) {
      console.error("Error al registrar el fallo de notificación:", recordError);
    }
  }

  return { status: "success", message: SUCCESS_MESSAGE };
}
