import type { Metadata } from "next";

import { MetricsCards } from "@/components/admin/metrics-cards";
import { Pagination } from "@/components/admin/pagination";
import { RequestFiltersForm } from "@/components/admin/request-filters";
import { RequestsTable } from "@/components/admin/requests-table";
import { requireAdmin } from "@/data/auth";
import { getMetrics, getRequests, parseRequestFilters } from "@/data/requests";

export const metadata: Metadata = {
  title: "Solicitudes — Panel de administración",
  robots: { index: false, follow: false },
};

/**
 * El panel nunca se sirve desde la caché de rutas: los datos son personales y
 * cambian con cada gestión. `requireAdmin()` es la barrera de autorización de
 * esta página; el DAL vuelve a verificar la sesión en cada consulta.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const rawSearchParams = await searchParams;
  const filters = parseRequestFilters(rawSearchParams);

  const [metrics, list] = await Promise.all([
    getMetrics(),
    getRequests(filters),
  ]);

  const hasActiveFilters = Boolean(
    filters.q || filters.status || filters.signerMode,
  );

  const totalLabel =
    list.total === 0
      ? hasActiveFilters
        ? "No hay solicitudes que coincidan con los filtros aplicados."
        : "Todavía no hay solicitudes registradas."
      : `Mostrando ${list.items.length} de ${list.total} solicitudes · página ${list.page} de ${list.totalPages}`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Solicitudes</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Gestiona las solicitudes de firma digital recibidas desde la web.
        </p>
      </div>

      <MetricsCards metrics={metrics} />

      <RequestFiltersForm filters={filters} />

      {list.total === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-zinc-900">
            {hasActiveFilters
              ? "Ninguna solicitud coincide con los filtros aplicados."
              : "Todavía no hay solicitudes registradas."}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {hasActiveFilters
              ? "Prueba a cambiar o limpiar los criterios de búsqueda."
              : "En cuanto se envíe el formulario de la web, aparecerá aquí."}
          </p>
        </div>
      ) : (
        <>
          <RequestsTable list={list} />
          <Pagination
            filters={filters}
            total={list.total}
            page={list.page}
            totalPages={list.totalPages}
            totalLabel={totalLabel}
          />
        </>
      )}
    </div>
  );
}
