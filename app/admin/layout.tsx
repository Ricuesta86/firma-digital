import Link from "next/link";

import { logout } from "@/app/admin/actions";
import { getSession } from "@/data/auth";

/**
 * Shell del panel de administración.
 *
 * La redirección de navegación la resuelve `proxy.ts`. Aquí solo se decide si se
 * monta la estructura autenticada: sin sesión se renderizan los hijos "pelados",
 * que es exactamente lo que necesita `/admin/login`. La autorización efectiva
 * la aplica cada página con `requireAdmin()` y cada acción con el DAL.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              FD
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                Panel de administración
              </p>
              <p className="text-xs text-zinc-500">
                Sesión: {session.email}
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href="/admin"
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              Solicitudes
            </Link>
            <Link
              href="/"
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              Ver web
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
              >
                Cerrar sesión
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
