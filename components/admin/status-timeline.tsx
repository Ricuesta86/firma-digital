import { requestStatusLabels, type RequestStatus } from "@/lib/request-status";
import type { RequestStatusEventDto } from "@/data/requests";
import { formatDateTime } from "@/components/admin/requests-table";

function label(status: RequestStatus | null): string {
  return status ? requestStatusLabels[status] : "Recepción";
}

export function StatusTimeline({ events }: { events: RequestStatusEventDto[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Todavía no se ha registrado ningún cambio de estado.
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {events.map((event) => (
        <li key={event.id} className="relative flex gap-4 pl-1">
          <span
            aria-hidden="true"
            className="mt-1.5 size-2.5 shrink-0 rounded-full bg-indigo-500 ring-4 ring-indigo-500/15"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-zinc-900">
              <span className="font-medium">{label(event.fromStatus)}</span>
              {" → "}
              <span className="font-medium">{label(event.toStatus)}</span>
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {formatDateTime(event.createdAt)}
            </p>
            {event.note ? (
              <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                {event.note}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
