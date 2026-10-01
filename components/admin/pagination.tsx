import Link from "next/link";

import { buildListUrl, type FiltersProps } from "@/components/admin/request-filters";

export function Pagination({
  filters,
  total,
  page,
  totalPages,
  totalLabel,
}: {
  filters: FiltersProps;
  total: number;
  page: number;
  totalPages: number;
  totalLabel: string;
}) {
  if (total === 0) {
    return null;
  }

  // Ventana de páginas alrededor de la actual, para no generar 200 enlaces.
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, Math.max(page + 2, 5));
  const pages: number[] = [];
  for (let i = Math.max(1, start); i <= end; i += 1) {
    pages.push(i);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-sm text-zinc-500">{totalLabel}</p>

      {totalPages > 1 ? (
        <nav aria-label="Paginación" className="flex items-center gap-1">
          {page > 1 ? (
            <Link
              href={buildListUrl(filters, { page: page - 1 })}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              Anterior
            </Link>
          ) : null}

          {pages.map((pageNumber) => (
            <Link
              key={pageNumber}
              href={buildListUrl(filters, { page: pageNumber })}
              aria-current={pageNumber === page ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                pageNumber === page
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {pageNumber}
            </Link>
          ))}

          {page < totalPages ? (
            <Link
              href={buildListUrl(filters, { page: page + 1 })}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              Siguiente
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
