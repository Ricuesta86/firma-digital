"use server";

import { requestSchema } from "@/lib/validation";
import { sendRequestEmail } from "@/lib/email";

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
    address: formData.get("address"),
    position: formData.get("position"),
    documentType: formData.get("documentType"),
    documentNumber: formData.get("documentNumber"),
    country: formData.get("country"),
    certificateType: formData.get("certificateType"),
    message: formData.get("message"),
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

  try {
    await sendRequestEmail(parsed.data);
    return {
      status: "success",
      message:
        "¡Solicitud enviada! Te contactaremos con los siguientes pasos para la emisión de tu firma digital.",
    };
  } catch (error) {
    console.error("Error al enviar el correo:", error);
    return {
      status: "error",
      message:
        "No se pudo enviar la solicitud en este momento. Comprueba la configuración SMTP o inténtalo más tarde.",
    };
  }
}