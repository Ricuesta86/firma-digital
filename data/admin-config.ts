import "server-only";

/**
 * Lectura de la configuración de administrador.
 *
 * Es el ÚNICO sitio del proyecto que lee `ADMIN_EMAIL`, `ADMIN_PASSWORD` y
 * `ADMIN_SESSION_SECRET` (design.md D5). `lib/auth.ts` es puro: recibe el
 * secreto y las credenciales esperadas como argumentos, de modo que la lógica
 * criptográfica se puede auditar y probar sin tocar el entorno.
 *
 * No importa `next/headers` a propósito: `proxy.ts` también necesita el secreto
 * para validar la cookie de navegación y no debe arrastrar el DAL de cookies.
 */

import { verifyCredentials, type CredentialsResult } from "@/lib/auth";

export type AdminCredentials = {
  email: string;
  password: string;
};

/** Credenciales esperadas, o `null` si el panel no está configurado. */
export function getAdminCredentials(): AdminCredentials | null {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    return null;
  }

  return { email, password };
}

/** Secreto de firma, o `null` si no está definido en el entorno. */
export function getSessionSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return secret && secret.length > 0 ? secret : null;
}

/**
 * Compara las credenciales con las del entorno. Devuelve el mismo motivo de
 * fallo para un correo desconocido y para una contraseña incorrecta, para no
 * revelar cuál de las dos es válida.
 */
export function verifyAdminCredentials(
  email: string,
  password: string,
): CredentialsResult {
  const expected = getAdminCredentials();

  if (!expected) {
    console.error(
      "FALTAN_CREDENCIALES_ADMIN: define ADMIN_EMAIL y ADMIN_PASSWORD para habilitar el acceso al panel.",
    );
    return { ok: false, reason: "not_configured" };
  }

  return verifyCredentials(email, password, expected.email, expected.password);
}
