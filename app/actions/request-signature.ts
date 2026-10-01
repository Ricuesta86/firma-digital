"use server";

import { requestSchema } from "@/lib/validation";
import { sendRequestEmail } from "@/lib/email";
import { createRequest, recordNotificationResult } from "@/data/requests";

export type RequestState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

function flattenIssues(
  error: import("zod").ZodError,
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

const SUCCESS_MESSAGE =
  "¡Solicitud enviada! Te contactaremos con los siguientes pasos para la emisión de tu firma digital.";

export async function requestSignature(
  _prevState: RequestState,
  formData: FormData,
): Promise<RequestState> {
  const raw = {
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    companyName: formData.get("companyName"),
    nif: formData.get("nif"),
    // Campos opcionales: si el cliente no los envía, `FormData.get` devuelve
    // `null` y el schema (que espera `undefined`) los rechazaría.
    address: formData.get("address") ?? undefined,
    position: formData.get("position"),
    documentType: formData.get("documentType"),
    documentNumber: formData.get("documentNumber"),
    country: formData.get("country"),
    certificateType: formData.get("certificateType"),
    message: formData.get("message") ?? undefined,
    privacyConsent: formData.get("privacyConsent") === "on",
  };

  const parsed = requestSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisa los campos marcados e inténtalo de nuevo.",
      fieldErrors: flattenIssues(parsed.error),
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
