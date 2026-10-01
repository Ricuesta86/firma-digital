import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AddNoteForm,
  StatusChangeForm,
} from "@/components/admin/status-change-form";
import { StatusBadge } from "@/components/admin/status-badge";
import { StatusTimeline } from "@/components/admin/status-timeline";
import { formatDateTime } from "@/components/admin/requests-table";
import { requireAdmin } from "@/data/auth";
import { getRequestById } from "@/data/requests";

export const metadata: Metadata = {
  title: "Ficha de solicitud — Panel de administración",
  robots: { index: false, follow: false },
};

type FieldProps = {
  label: string;
  value: string | null | undefined;
};

function Field({ label, value }: FieldProps) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-zinc-900">
        {value && value.length > 0 ? value : "—"}
      </dd>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const request = await getRequestById(id);

  if (!request) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="text-sm font-medium text-indigo-600 underline-offset-2 hover:text-indigo-700 hover:underline"
          >
            ← Volver al listado
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-zinc-900">
            {request.fullName}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            {request.companyName} · Recibida el{" "}
            {formatDateTime(request.createdAt)}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      {request.notificationError ? (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-5"
        >
          <h2 className="text-sm font-semibold text-amber-900">
            El correo de aviso no se envió
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            La solicitud está guardada correctamente, pero el aviso por correo
            falló. Motivo:{" "}
            <span className="font-mono text-xs">{request.notificationError}</span>
          </p>
        </div>
      ) : request.notificationSentAt ? (
        <p className="text-sm text-zinc-500">
          Correo de aviso enviado el {formatDateTime(request.notificationSentAt)}.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Datos del solicitante">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Nombre completo" value={request.fullName} />
              <Field label="Email" value={request.email} />
              <Field label="Teléfono" value={request.phone} />
              <Field label="País de residencia" value={request.country} />
            </dl>
          </Card>

          <Card title="Empresa">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Razón social" value={request.companyName} />
              <Field label="NIF/CIF" value={request.nif} />
              <Field label="Cargo" value={request.position} />
              <Field label="Dirección" value={request.address} />
            </dl>
          </Card>

          <Card title="Verificación de identidad">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Tipo de documento" value={request.documentType} />
              <Field
                label="Número de documento"
                value={request.documentNumber}
              />
            </dl>
          </Card>

          <Card title="Solicitud">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label="Tipo de certificado"
                value={request.certificateType}
              />
              <Field label="Mensaje" value={request.message} />
            </dl>
            <p className="mt-5 text-xs text-zinc-500">
              Consentimiento de privacidad aceptado:{" "}
              {request.privacyConsent ? "sí" : "no"}.
            </p>
          </Card>

          <Card title="Historial de estados">
            <StatusTimeline events={request.events} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Cambiar estado">
            <StatusChangeForm
              requestId={request.id}
              currentStatus={request.status}
            />
          </Card>

          <Card title="Notas internas">
            {request.adminNotes ? (
              <p className="mb-4 whitespace-pre-wrap rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                {request.adminNotes}
              </p>
            ) : (
              <p className="mb-4 text-sm text-zinc-500">
                Todavía no hay notas internas.
              </p>
            )}
            <AddNoteForm requestId={request.id} />
          </Card>
        </div>
      </div>
    </div>
  );
}
