import Link from "next/link";

import { certificateTypes } from "@/lib/validation";
import {
  requestStatuses,
  requestStatusLabels,
  type RequestStatus,
} from "@/lib/request-status";

const selectClasses =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30";

export type FiltersProps = {
  q?: string;
  status?: RequestStatus;
  certificateType?: string;
  page: number;
  pageSize: number;
};

/**
 * Construye la URL del listado a partir de criterios. Al cambiar de página se
 * reinicia a 1 y al aplicar un filtro se eliminan los parámetros que ya no
 * aplican, para que la barra de direcciones refleje siempre el estado real.
 */
export function buildListUrl(
  filters: Partial<FiltersProps>,
  overrides: Partial<FiltersProps> & { resetPage?: boolean } = {},
): string {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (merged.q) params.set("q", merged.q);
  if (merged.status) params.set("status", merged.status);
  if (merged.certificateType)
    params.set("certificateType", merged.certificateType);
  if (merged.pageSize && merged.pageSize !== 20)
    params.set("pageSize", String(merged.pageSize));

  const page = overrides.resetPage ? 1 : (merged.page ?? 1);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}

export function RequestFiltersForm({ filters }: { filters: FiltersProps }) {
  return (
    <form
      action="/admin"
      method="get"
      className="rounded-2xl border border-zinc-200 bg-white p-5"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label
            htmlFor="q"
            className="mb-1.5 block text-sm font-medium text-zinc-700"
          >
            Buscar
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Nombre, email, razón social o NIF"
            className={selectClasses}
          />
        </div>

        <div>
          <label
            htmlFor="status"
            className="mb-1.5 block text-sm font-medium text-zinc-700"
          >
            Estado
          </label>
          <select
            id="status"
            name="status"
            defaultValue={filters.status ?? ""}
            className={selectClasses}
          >
            <option value="">Todos</option>
            {requestStatuses.map((status) => (
              <option key={status} value={status}>
                {requestStatusLabels[status]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="certificateType"
            className="mb-1.5 block text-sm font-medium text-zinc-700"
          >
            Tipo de certificado
          </label>
          <select
            id="certificateType"
            name="certificateType"
            defaultValue={filters.certificateType ?? ""}
            className={selectClasses}
          >
            <option value="">Todos</option>
            {certificateTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          Aplicar filtros
        </button>

        {filters.q || filters.status || filters.certificateType ? (
          <Link
            href="/admin"
            className="text-sm font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
          >
            Limpiar
          </Link>
        ) : null}

        <Link
          href={`/api/admin/export${filters.q || filters.status || filters.certificateType ? `?${new URLSearchParams(
            Object.entries({
              ...(filters.q ? { q: filters.q } : {}),
              ...(filters.status ? { status: filters.status } : {}),
              ...(filters.certificateType
                ? { certificateType: filters.certificateType }
                : {}),
            }),
          )}` : ""}`}
          className="ml-auto text-sm font-medium text-indigo-600 underline-offset-2 hover:text-indigo-700 hover:underline"
        >
          Descargar CSV
        </Link>
      </div>
    </form>
  );
}
