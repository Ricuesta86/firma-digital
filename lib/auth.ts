/**
 * Utilidades de sesión del administrador.
 *
 * Este módulo NO toca la base de datos, NO lee cookies y NO lee `process.env`:
 * solo firma, verifica y compara. La lectura de cookies vive exclusivamente en
 * `data/auth.ts` y la de los secretos en `data/admin-config.ts`, que inyectan
 * aquí el secreto y las credenciales esperadas (design.md D5).
 *
 * Usa Web Crypto (`crypto.subtle`) y no `node:crypto` porque `proxy.ts` corre
 * en el runtime Node desde Next 16 pero debe seguir siendo portable, y Web
 * Crypto está disponible en ambos runtimes sin importar nada.
 */

export const SESSION_COOKIE_NAME = "fd_admin_session";

/** Caducidad de la sesión: una jornada laboral. */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const encoder = new TextEncoder();

export type AdminSession = {
  email: string;
  issuedAt: number;
  expiresAt: number;
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return new Uint8Array(signature);
}

/**
 * Comparación en tiempo constante. Devuelve `false` en cuanto detecta que las
 * longitudes difieren, porque esa fuga es inevitable: el objetivo es que el
 * tiempo no dependa del contenido ni de cuántos caracteres coinciden.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const bufferA = encoder.encode(a);
  const bufferB = encoder.encode(b);

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < bufferA.length; i += 1) {
    diff |= bufferA[i] ^ bufferB[i];
  }
  return diff === 0;
}

/**
 * Firma un token de sesión con el secreto recibido. Quien llama es responsable
 * de haber leído el secreto de `data/admin-config.ts`.
 */
export async function createSessionToken(
  email: string,
  secret: string,
  now: number = Date.now(),
): Promise<string> {
  const payload: AdminSession = {
    email,
    issuedAt: now,
    expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await hmacSha256(secret, encodedPayload);
  return `${encodedPayload}.${toBase64Url(signature)}`;
}

/**
 * Verifica el token y devuelve la sesión, o `null` si la cookie está ausente,
 * manipulada, caducada o mal formada. Nunca lanza.
 */
export async function verifySessionToken(
  token: string | undefined,
  secret: string | null,
  now: number = Date.now(),
): Promise<AdminSession | null> {
  try {
    return await verifySessionTokenUnsafe(token, secret, now);
  } catch {
    // Cualquier fallo de decodificación significa "cookie no válida". Esta
    // función nunca lanza: quien la usa no debe poder distinguir una cookie
    // corrupta de una ausente.
    return null;
  }
}

async function verifySessionTokenUnsafe(
  token: string | undefined,
  secret: string | null,
  now: number,
): Promise<AdminSession | null> {
  if (!token) {
    return null;
  }

  if (!secret) {
    console.error(
      "FALTA_ADMIN_SESSION_SECRET: no se puede verificar la sesión de administración.",
    );
    return null;
  }

  const separator = token.lastIndexOf(".");
  if (separator <= 0) {
    return null;
  }

  const encodedPayload = token.slice(0, separator);
  const providedSignature = token.slice(separator + 1);

  const expectedSignature = toBase64Url(
    await hmacSha256(secret, encodedPayload),
  );

  // Comprobación de longitud sobre las cadenas antes de decodificar: descarta
  // la mayoría de tokens manipulados sin lanzar y sin filtrar por temporización.
  if (providedSignature.length !== expectedSignature.length) {
    return null;
  }
  if (!timingSafeEqual(providedSignature, expectedSignature)) {
    return null;
  }

  const payload = JSON.parse(
    new TextDecoder().decode(fromBase64Url(encodedPayload)),
  ) as Partial<AdminSession>;

  if (
    typeof payload.email !== "string" ||
    payload.email.length === 0 ||
    typeof payload.issuedAt !== "number" ||
    typeof payload.expiresAt !== "number"
  ) {
    return null;
  }

  if (payload.expiresAt <= now) {
    return null;
  }

  return {
    email: payload.email,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  };
}

export type CredentialsResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "not_configured" };

/**
 * Compara en tiempo constante las credenciales con las esperadas. No conoce el
 * entorno: recibe los valores esperados, que le pasa `data/admin-config.ts`.
 * Devuelve el mismo motivo de fallo para un correo desconocido y para una
 * contraseña incorrecta, para no revelar cuál de las dos es válida.
 */
export function verifyCredentials(
  email: string,
  password: string,
  expectedEmail: string,
  expectedPassword: string,
): CredentialsResult {
  const emailMatches = timingSafeEqual(
    email.trim().toLowerCase(),
    expectedEmail.trim().toLowerCase(),
  );
  const passwordMatches = timingSafeEqual(password, expectedPassword);

  if (!emailMatches || !passwordMatches) {
    return { ok: false, reason: "invalid" };
  }

  return { ok: true };
}
