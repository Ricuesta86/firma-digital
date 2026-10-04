import {
  requestStatusLabels,
  requestStatuses,
  type RequestStatus,
} from "@/lib/request-status";
import { signerModeLabels } from "@/lib/validation";
import type { RequestMetricsDto } from "@/data/requests";

const accents: Record<RequestStatus, string> = {
  NEW: "text-sky-600",
  IN_REVIEW: "text-amber-600",
  ACCEPTED: "text-emerald-600",
  REJECTED: "text-rose-600",
};

export function MetricsCards({ metrics }: { metrics: RequestMetricsDto }) {
  const maxSignerMode = Math.max(
    1,
    ...metrics.bySignerMode.map((row) => row.count),
  );

  return (
    <section aria-label="Resumen" className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="col-span-2 rounded-2xl border border-zinc-200 bg-white p-5 lg:col-span-1">
          <p className="text-sm font-medium text-zinc-500">Total</p>
          <p className="mt-1 text-3xl font-bold text-zinc-900">
            {metrics.total}
          </p>
        </div>

        {requestStatuses.map((status) => (
          <div
            key={status}
            className="rounded-2xl border border-zinc-200 bg-white p-5"
          >
            <p className="text-sm font-medium text-zinc-500">
              {requestStatusLabels[status]}
            </p>
            <p className={`mt-1 text-3xl font-bold ${accents[status]}`}>
              {metrics.byStatus[status]}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-zinc-900">
          Solicitudes por modo de firmante
        </h2>
        {metrics.bySignerMode.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            Todavía no hay solicitudes registradas.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {metrics.bySignerMode.map((row) => (
              <li key={row.signerMode}>
                <div className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="text-zinc-700">
                    {signerModeLabels[row.signerMode as keyof typeof signerModeLabels] ??
                      row.signerMode}
                  </span>
                  <span className="font-medium text-zinc-900">{row.count}</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${(row.count / maxSignerMode) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
