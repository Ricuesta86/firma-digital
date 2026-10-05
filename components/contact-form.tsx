"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { requestSignature, type RequestState } from "@/app/actions/request-signature";
import { ApplicantRosterModal } from "@/components/applicant-roster-modal";
import {
  signerModes,
  signerModeLabels,
  type Applicant,
} from "@/lib/validation";

const initialState: RequestState = { status: "idle" };

const inputClasses =
  "w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30";

const errorInputClasses =
  "w-full rounded-lg border border-red-400 bg-red-50/50 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30";

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

function Fieldset({
  legend,
  children,
}: {
  legend: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-5">
      <legend className="text-base font-semibold text-zinc-900">{legend}</legend>
      {children}
    </fieldset>
  );
}

export function ContactForm() {
  const [state, formAction, pending] = useActionState(
    requestSignature,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  const [signerMode, setSignerMode] = useState<string>("personal");
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [rosterOpen, setRosterOpen] = useState(false);

  // Tras un error de validación la relación y el modo vuelven en el estado de la
  // acción: se reponen aquí para que el modal no se presente vacío
  // (design.md D4). `useActionState` devuelve un objeto nuevo en cada envío, así
  // que la comparación es por identidad y se ajusta el estado durante el render
  // en lugar de provocar renders en cascada desde un efecto.
  const [rehydratedState, setRehydratedState] = useState<RequestState | null>(null);

  if (state !== rehydratedState) {
    setRehydratedState(state);

    if (state.status === "error") {
      if (state.applicants) {
        setApplicants(state.applicants);
      }

      if (state.signerMode) {
        setSignerMode(state.signerMode);
      }

      // Si el error está en la relación, el modal se reabre para que el visitante
      // vea qué fila hay que corregir.
      const relacioConErrores = Object.keys(state.fieldErrors ?? {}).some(
        (key) => key.startsWith("applicants"),
      );

      setRosterOpen(relacioConErrores);
    }
  }

  // El formulario se desmonta al mostrar el aviso de éxito, así que solo hay que
  // limpiar los campos del DOM que quedan fuera de la vista de éxito.
  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  const esModoMultiple = signerMode === "multiple";

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-900/5 sm:p-10">
      {state.status === "success" ? (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <svg
              className="size-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <h3 className="text-xl font-semibold text-zinc-900">
            Solicitud enviada
          </h3>
          <p className="max-w-md text-sm leading-6 text-zinc-600">
            {state.message}
          </p>
          <a
            href="#inicio"
            className="mt-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Volver al inicio
          </a>
        </div>
      ) : (
        <form ref={formRef} action={formAction} noValidate>
          <div className="space-y-8">
            {state.status === "error" && state.message && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {state.message}
              </div>
            )}

            <Fieldset legend="Datos personales">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field
                  id="fullName"
                  label="Nombre completo"
                  required
                  error={state.fieldErrors?.fullName?.[0]}
                >
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    required
                    className={
                      state.fieldErrors?.fullName
                        ? errorInputClasses
                        : inputClasses
                    }
                  />
                </Field>

                <Field
                  id="email"
                  label="Email"
                  required
                  error={state.fieldErrors?.email?.[0]}
                >
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className={
                      state.fieldErrors?.email ? errorInputClasses : inputClasses
                    }
                  />
                </Field>

                <Field
                  id="phone"
                  label="Teléfono"
                  required
                  error={state.fieldErrors?.phone?.[0]}
                >
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    className={
                      state.fieldErrors?.phone ? errorInputClasses : inputClasses
                    }
                  />
                </Field>

                <Field
                  id="personalAddress"
                  label="Dirección"
                  error={state.fieldErrors?.personalAddress?.[0]}
                >
                  <input
                    id="personalAddress"
                    name="personalAddress"
                    type="text"
                    className={inputClasses}
                  />
                </Field>
              </div>
            </Fieldset>

            <Fieldset legend="Datos de la empresa">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field
                  id="companyName"
                  label="Razón social"
                  required
                  error={state.fieldErrors?.companyName?.[0]}
                >
                  <input
                    id="companyName"
                    name="companyName"
                    type="text"
                    required
                    className={
                      state.fieldErrors?.companyName
                        ? errorInputClasses
                        : inputClasses
                    }
                  />
                </Field>

                <Field
                  id="businessName"
                  label="Nombre de la empresa"
                  required
                  error={state.fieldErrors?.businessName?.[0]}
                >
                  <input
                    id="businessName"
                    name="businessName"
                    type="text"
                    required
                    className={
                      state.fieldErrors?.businessName
                        ? errorInputClasses
                        : inputClasses
                    }
                  />
                </Field>

                <Field
                  id="reeupCode"
                  label="Código REEUP"
                  required
                  error={state.fieldErrors?.reeupCode?.[0]}
                >
                  <input
                    id="reeupCode"
                    name="reeupCode"
                    type="text"
                    required
                    className={
                      state.fieldErrors?.reeupCode ? errorInputClasses : inputClasses
                    }
                  />
                </Field>

                <Field
                  id="address"
                  label="Dirección de la empresa"
                  error={state.fieldErrors?.address?.[0]}
                >
                  <input
                    id="address"
                    name="address"
                    type="text"
                    className={inputClasses}
                  />
                </Field>
              </div>
            </Fieldset>

            <Fieldset legend="Solicitud">
              <div className="space-y-3">
                <p className="text-sm font-medium text-zinc-700">
                  ¿Para quién es la firma?
                  <span className="text-red-500"> *</span>
                </p>
                <div
                  role="radiogroup"
                  aria-label="Modo de firmante"
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                >
                  {signerModes.map((mode) => (
                    <label
                      key={mode}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${
                        signerMode === mode
                          ? "border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500/30"
                          : "border-zinc-300 bg-white hover:border-zinc-400"
                      }`}
                    >
                      <input
                        type="radio"
                        name="signerMode"
                        value={mode}
                        checked={signerMode === mode}
                        onChange={() => setSignerMode(mode)}
                        className="mt-0.5 size-4 shrink-0 accent-indigo-600"
                      />
                      <span>
                        <span className="block text-sm font-medium text-zinc-900">
                          {signerModeLabels[mode]}
                        </span>
                        <span className="mt-0.5 block text-xs text-zinc-600">
                          {mode === "personal"
                            ? "Un único firmante, con su carnet de identidad."
                            : "Una relación de personas, con alta, carga masiva y envío conjunto."}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                {state.fieldErrors?.signerMode && (
                  <p className="text-xs font-medium text-red-600">
                    {state.fieldErrors.signerMode[0]}
                  </p>
                )}
              </div>

              {/* El carnet solo se pide al firmante único: en modo múltiple va
                  por cada solicitante, dentro del modal (design.md D3). */}
              {signerMode === "personal" && (
                <Field
                  id="personalIdNumber"
                  label="Número de carnet de identidad"
                  required
                  error={state.fieldErrors?.personalIdNumber?.[0]}
                >
                  <input
                    id="personalIdNumber"
                    name="personalIdNumber"
                    type="text"
                    className={
                      state.fieldErrors?.personalIdNumber
                        ? errorInputClasses
                        : inputClasses
                    }
                  />
                </Field>
              )}

              {/* Las acciones de gestión solo existen en modo múltiple. */}
              {esModoMultiple && (
                <ApplicantRosterModal
                  applicants={applicants}
                  onChange={setApplicants}
                  open={rosterOpen}
                  onOpenChange={setRosterOpen}
                  fieldErrors={state.fieldErrors}
                />
              )}

              {/* La relación viaja al servidor en un único campo oculto con JSON,
                  en el mismo envío (design.md D4). */}
              <input
                type="hidden"
                name="applicants"
                value={esModoMultiple ? JSON.stringify(applicants) : ""}
              />

              <Field
                id="message"
                label="Mensaje (opcional)"
                error={state.fieldErrors?.message?.[0]}
              >
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  maxLength={2000}
                  className={inputClasses}
                />
              </Field>
            </Fieldset>

            <div>
              <div className="flex items-start gap-3">
                <input
                  id="privacyConsent"
                  name="privacyConsent"
                  type="checkbox"
                  required
                  className="mt-0.5 size-4 shrink-0 rounded border-zinc-300 accent-indigo-600"
                />
                <label
                  htmlFor="privacyConsent"
                  className="text-sm leading-6 text-zinc-600"
                >
                  He leído y acepto la{" "}
                  <a
                    href="#"
                    onClick={(event) => event.preventDefault()}
                    className="font-medium text-indigo-600 underline-offset-2 hover:underline"
                  >
                    política de privacidad
                  </a>{" "}
                  y el tratamiento de mis datos para gestionar esta solicitud.
                  <span className="text-red-500"> *</span>
                </label>
              </div>
              {state.fieldErrors?.privacyConsent && (
                <p className="mt-1.5 text-xs font-medium text-red-600">
                  {state.fieldErrors.privacyConsent[0]}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-full bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Enviando…" : "Enviar solicitud"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
