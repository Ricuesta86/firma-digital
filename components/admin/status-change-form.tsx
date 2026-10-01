"use client";

import { useActionState } from "react";

import {
  addInternalNoteAction,
  updateRequestStatusAction,
  type ActionResult,
} from "@/app/admin/actions";
import {
  nextStatuses,
  requestStatusLabels,
  type RequestStatus,
} from "@/lib/request-status";

const initialState: ActionResult = { success: false };

const selectClasses =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30";

const buttonClasses =
  "rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60";

function ResultMessage({ state }: { state: ActionResult }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p
        role="status"
        className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
      >
        Guardado.
      </p>
    );
  }
  return null;
}

export function StatusChangeForm({
  requestId,
  currentStatus,
}: {
  requestId: string;
  currentStatus: RequestStatus;
}) {
  const allowed = nextStatuses(currentStatus);

  if (allowed.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No hay ningún cambio de estado disponible desde «
        {requestStatusLabels[currentStatus]}».
      </p>
    );
  }

  return (
    <ChangeForm
      key={currentStatus}
      requestId={requestId}
      action={async (prev, formData) => {
        const to = String(formData.get("to") ?? "");
        const note = String(formData.get("note") ?? "");
        return updateRequestStatusAction(requestId, to, note);
      }}
      allowed={allowed}
      submitLabel="Cambiar estado"
    />
  );
}

export function AddNoteForm({ requestId }: { requestId: string }) {
  return (
    <ChangeForm
      requestId={requestId}
      action={async (prev, formData) => {
        const text = String(formData.get("note") ?? "");
        return addInternalNoteAction(requestId, text);
      }}
      submitLabel="Añadir nota"
      withStatus={false}
    />
  );
}

function ChangeForm({
  action,
  allowed,
  submitLabel,
  withStatus = true,
}: {
  requestId: string;
  action: (
    prev: ActionResult,
    formData: FormData,
  ) => Promise<ActionResult>;
  allowed?: readonly RequestStatus[];
  submitLabel: string;
  withStatus?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const statusOptions = allowed ?? [];

  return (
    <form action={formAction} className="space-y-4">
      <ResultMessage state={state} />

      {withStatus && statusOptions.length > 0 ? (
        <div>
          <label
            htmlFor="to"
            className="mb-1.5 block text-sm font-medium text-zinc-700"
          >
            Nuevo estado
          </label>
          <select id="to" name="to" required className={selectClasses}>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {requestStatusLabels[status]}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label
          htmlFor={withStatus ? "note-status" : "note"}
          className="mb-1.5 block text-sm font-medium text-zinc-700"
        >
          {withStatus ? "Comentario (opcional)" : "Nota interna"}
        </label>
        <textarea
          id={withStatus ? "note-status" : "note"}
          name="note"
          rows={3}
          maxLength={2000}
          required={!withStatus}
          className={`${selectClasses} resize-y`}
        />
      </div>

      <button type="submit" disabled={pending} className={buttonClasses}>
        {pending ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}
