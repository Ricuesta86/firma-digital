import {
  requestStatusLabels,
  type RequestStatus,
} from "@/lib/request-status";

const styles: Record<RequestStatus, string> = {
  NEW: "bg-sky-100 text-sky-700 ring-sky-600/20",
  IN_REVIEW: "bg-amber-100 text-amber-800 ring-amber-600/20",
  ACCEPTED: "bg-emerald-100 text-emerald-700 ring-emerald-600/20",
  REJECTED: "bg-rose-100 text-rose-700 ring-rose-600/20",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${styles[status]}`}
    >
      {requestStatusLabels[status]}
    </span>
  );
}
