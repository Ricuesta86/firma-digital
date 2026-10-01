import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { getSessionSecret } from "@/data/admin-config";

/**
 * Proxy de administración (design.md D3).
 *
 * Solo hace REDIRECCIÓN de navegación. No consulta la base de datos y no es la
 * barrera de autorización: las Server Functions se atienden como POST sobre la
 * ruta que las usa y no pasan por esta cadena, y la documentación de Next.js 16
 * advierte de que cambiar el matcher elimina la cobertura en silencio. La
 * autorización real vive en `data/auth.ts` y en `data/requests.ts`, que
 * revalidan la sesión en cada acción y endpoint.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isLoginRoute = pathname === "/admin/login";

  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
    getSessionSecret(),
  );

  if (!session && !isLoginRoute) {
    const loginUrl = new URL("/admin/login", request.url);
    // Se conserva la URL de destino para volver tras identificarse.
    if (pathname !== "/admin") {
      loginUrl.searchParams.set("next", `${pathname}${search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (session && isLoginRoute) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
