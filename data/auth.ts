import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  type AdminSession,
  verifySessionToken,
} from "@/lib/auth";
import { getSessionSecret } from "@/data/admin-config";

export type { AdminSession };

export const ADMIN_LOGIN_PATH = "/admin/login";
export const ADMIN_ROOT_PATH = "/admin";

/** Sesión actual del administrador, o `null` si no hay ninguna válida. */
export async function getSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  return verifySessionToken(
    cookieStore.get(SESSION_COOKIE_NAME)?.value,
    getSessionSecret(),
  );
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getSession()) !== null;
}

/**
 * Exige sesión de administrador. Si no la hay, redirige al login.
 *
 * Pensado para páginas y layouts. NO sustituye a la verificación dentro de las
 * Server Actions: estas son puntos de entrada independientes y deben
 * revalidar por sí mismas (design.md D3).
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) {
    redirect(ADMIN_LOGIN_PATH);
  }
  return session;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
