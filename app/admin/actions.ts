"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME, createSessionToken } from "@/lib/auth";
import { getSessionSecret, verifyAdminCredentials } from "@/data/admin-config";
import { ADMIN_LOGIN_PATH, ADMIN_ROOT_PATH, sessionCookieOptions } from "@/data/auth";
import {
  RequestError,
  addInternalNote as addNote,
  updateRequestStatus as setStatus,
} from "@/data/requests";

export type LoginState = {
  status: "idle" | "error";
  message?: string;
};

/** Resultado de una mutación del panel. Nunca incluye datos de la solicitud. */
export type ActionResult = {
  success: boolean;
  error?: string;
};

// Mensaje único e indistinguible: no revela si el correo existe o si la
// contraseña es incorrecta.
const INVALID_CREDENTIALS_MESSAGE = "Credenciales incorrectas.";
const NOT_CONFIGURED_MESSAGE =
  "El acceso al panel no está configurado. Revisa ADMIN_EMAIL y ADMIN_PASSWORD.";

/** Destino seguro tras el login: solo rutas internas del panel. */
function safeRedirectTarget(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/admin")) {
    return ADMIN_ROOT_PATH;
  }
  // Evita redirecciones fuera del panel (//evil.com, /\/evil, etc.).
  if (value.startsWith("//") || value.includes("\\") || value.includes("..")) {
    return ADMIN_ROOT_PATH;
  }
  return value;
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectTarget(formData.get("next"));

  const result = verifyAdminCredentials(email, password);

  if (!result.ok) {
    return {
      status: "error",
      message:
        result.reason === "not_configured"
          ? NOT_CONFIGURED_MESSAGE
          : INVALID_CREDENTIALS_MESSAGE,
    };
  }

  let token: string;
  try {
    const secret = getSessionSecret();
    if (!secret) {
      throw new Error("FALTA_ADMIN_SESSION_SECRET");
    }
    token = await createSessionToken(email.trim().toLowerCase(), secret);
  } catch (error) {
    console.error("No se pudo firmar la sesión de administración:", error);
    return {
      status: "error",
      message: NOT_CONFIGURED_MESSAGE,
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());

  redirect(next);
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect(ADMIN_LOGIN_PATH);
}

/**
 * Cambia el estado de una solicitud.
 *
 * El DAL revalida la sesión y comprueba la transición: que esta página ya
 * estuviera autorizada no cubre esta acción, que es un punto de entrada
 * independiente.
 */
export async function updateRequestStatusAction(
  id: string,
  to: string,
  note: string,
): Promise<ActionResult> {
  try {
    await setStatus(id, to, note);
  } catch (error) {
    return { success: false, error: toMessage(error) };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/requests/${id}`);
  return { success: true };
}

export async function addInternalNoteAction(
  id: string,
  text: string,
): Promise<ActionResult> {
  try {
    await addNote(id, text);
  } catch (error) {
    return { success: false, error: toMessage(error) };
  }

  revalidatePath(`/admin/requests/${id}`);
  revalidatePath("/admin");
  return { success: true };
}

function toMessage(error: unknown): string {
  if (error instanceof RequestError) {
    if (error.code === "unauthorized") {
      return "No autorizado.";
    }
    return error.message;
  }
  console.error("Error inesperado en una acción del panel:", error);
  return "Se produjo un error inesperado. Inténtalo de nuevo.";
}
