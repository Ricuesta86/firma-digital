import type { Metadata } from "next";

import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = {
  title: "Acceso — Panel de administración",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = rawNext?.startsWith("/admin") ? rawNext : undefined;

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
            FirmaDigital
          </p>
          <h1 className="mt-2 text-2xl font-bold text-zinc-900">
            Panel de administración
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Acceso restringido al equipo de gestión.
          </p>
        </div>

        <LoginForm next={next} />
      </div>
    </main>
  );
}
