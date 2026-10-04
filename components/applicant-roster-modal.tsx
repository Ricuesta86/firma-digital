"use client";

import { useEffect, useRef, useState } from "react";

import {
  applicantSchema,
  MAX_APPLICANTS,
  type Applicant,
} from "@/lib/validation";

/**
 * Gestión de la relación de solicitantes sobre un `<dialog>` nativo.
 *
 * No hay librería de UI en el proyecto y no se introduce una solo para esto:
 * `showModal()` aporta de forma nativa el foco atrapado, `::backdrop` y el
 * cierre con `Escape` (design.md D8).
 *
 * La importación y la exportación ocurren EN SERVIDOR: el navegador sube el
 * fichero y recibe filas ya validadas, y `exceljs` no forma parte del bundle del
 * cliente (design.md D5).
 *
 * Vive fuera del `<form>` del formulario público: dentro habría un formulario
 * anidado, que el HTML no permite. La relación viaja al servidor por un input
 * oculto que vive en el formulario.
 */

type ApplicantField = keyof Pick<
  Applicant,
  "fullName" | "idNumber" | "address" | "email" | "phone"
>;

const FIELDS: Array<{ key: ApplicantField; label: string; type: string }> = [
  { key: "fullName", label: "Nombre y apellidos", type: "text" },
  { key: "idNumber", label: "Número de carnet de identidad", type: "text" },
  { key: "address", label: "Dirección", type: "text" },
  { key: "email", label: "Correo electrónico", type: "email" },
  { key: "phone", label: "Número del móvil", type: "tel" },
];

const EMPTY_APPLICANT: Applicant = {
  fullName: "",
  idNumber: "",
  address: "",
  email: "",
  phone: "",
};

const FILE_INPUT_ID = "roster-import-file";

const inputClasses =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30";

const errorInputClasses =
  "w-full rounded-lg border border-red-400 bg-red-50/50 px-3 py-2 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30";

const buttonClasses =
  "inline-block rounded-full px-4 py-2 text-center text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const primaryButtonClasses = `${buttonClasses} bg-indigo-600 text-white hover:bg-indigo-700`;

const secondaryButtonClasses = `${buttonClasses} border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50`;

type ImportNotice = {
  tone: "error" | "info";
  headline: string;
  rows: Array<{ fila: number; mensaje: string }>;
};

export function ApplicantRosterModal({
  applicants,
  onChange,
  open,
  onOpenChange,
  fieldErrors,
}: {
  applicants: Applicant[];
  onChange: (next: Applicant[]) => void;
  /** El `<dialog>` es controlado por el padre, que también lo reabre tras un error. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Errores del servidor, con rutas `applicants.N.campo` (design.md D4). */
  fieldErrors?: Record<string, string[]>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<Applicant>(EMPTY_APPLICANT);
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});

  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<ImportNotice | null>(null);

  // `showModal()` y `close()` son la única forma de abrir y cerrar. Escape y el
  // clic en el fondo los gestiona el propio `<dialog>`, que avisa con `close`.
  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
      return;
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  /** Error del servidor para una ruta `applicants.N.campo`. */
  const serverError = (index: number, field: string) =>
    fieldErrors?.[`applicants.${index}.${field}`]?.[0];

  const rosterErrors = Object.entries(fieldErrors ?? {})
    .filter(([key]) => key === "applicants" || key.startsWith("applicants."))
    .map(([, messages]) => messages[0]);

  const atLimit = applicants.length >= MAX_APPLICANTS;

  const openEditor = (index: number | null) => {
    setDraftErrors({});
    setEditingIndex(index);
    setDraft(index === null ? EMPTY_APPLICANT : applicants[index]);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingIndex(null);
    setDraft(EMPTY_APPLICANT);
    setDraftErrors({});
  };

  const saveApplicant = () => {
    // Valida con el MISMO schema que el servidor: lo espeja, no lo sustituye.
    const parsed = applicantSchema.safeParse(draft);

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[String(issue.path[0] ?? "form")] ??= issue.message;
      }
      setDraftErrors(errors);
      return;
    }

    if (editingIndex === null) {
      if (atLimit) {
        return;
      }
      onChange([...applicants, parsed.data]);
    } else {
      // Editar sustituye la fila: no deja una duplicada.
      onChange(
        applicants.map((applicant, index) =>
          index === editingIndex ? parsed.data : applicant,
        ),
      );
    }

    closeEditor();
  };

  const removeApplicant = (index: number) => {
    onChange(applicants.filter((_, rowIndex) => rowIndex !== index));
    if (editingIndex === index) {
      closeEditor();
    }
  };

  const exportRoster = async () => {
    setNotice(null);

    try {
      // Se envía la relación para que el fichero descargado sea el mismo que
      // llega adjunto en el correo de aviso (design.md D7).
      const response = await fetch("/api/roster/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicants }),
      });

      if (!response.ok) {
        setNotice({
          tone: "error",
          headline:
            "No se ha podido generar el fichero de solicitantes. Inténtalo de nuevo.",
          rows: [],
        });
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        /filename="([^"]+)"/.exec(disposition)?.[1] ?? "solicitantes.xlsx";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setNotice({
        tone: "error",
        headline:
          "No se ha podido conectar con el servidor para generar el fichero.",
        rows: [],
      });
    }
  };

  const importRoster = async (file: File) => {
    setImporting(true);
    setNotice(null);

    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch("/api/roster/import", {
        method: "POST",
        body,
      });

      const payload = (await response.json().catch(() => ({}))) as {
        filas?: Applicant[];
        errores?: Array<{ fila: number; mensaje: string }>;
        total?: number;
        error?: string;
      };

      const filas = payload.filas ?? [];
      const errores = payload.errores ?? [];

      if (!response.ok && filas.length === 0 && errores.length === 0) {
        // El fichero entero se rechaza por tamaño, formato o cabecera. Se
        // distingue del error de contenido, que sí señala filas (design.md D5).
        const motivo = payload.error ?? "No se ha podido leer el fichero.";
        setNotice({
          tone: "error",
          headline:
            response.status === 413 ? `Fichero demasiado grande: ${motivo}` : motivo,
          rows: [],
        });
        return;
      }

      if (errores.length > 0) {
        const invalidas = new Set(errores.map((error) => error.fila)).size;
        setNotice({
          tone: "error",
          headline: `Se han importado ${filas.length} de ${
            payload.total ?? filas.length + invalidas
          } filas. Corrige las que faltan:`,
          rows: errores,
        });
      } else {
        setNotice({
          tone: "info",
          headline: `Se han importado ${
            filas.length === 1 ? "1 persona" : `${filas.length} personas`
          } a la relación.`,
          rows: [],
        });
      }

      // La importación SUMA: lo que el visitante ya había añadido se conserva.
      onChange([...applicants, ...filas]);
    } catch {
      setNotice({
        tone: "error",
        headline:
          "No se ha podido conectar con el servidor. Inténtalo de nuevo en unos minutos.",
        rows: [],
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      {/* Un único input para los dos accesos a la carga masiva. Se abre con un
          `<label>` y no con `.click()`: sin activación del usuario, algunos
          navegadores rechazan abrir el selector de ficheros. */}
      <input
        id={FILE_INPUT_ID}
        type="file"
        accept=".xlsx,.csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void importRoster(file);
          }
          // Se vacía para poder reimportar el mismo fichero.
          event.target.value = "";
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            onOpenChange(true);
            openEditor(null);
          }}
          disabled={atLimit}
          className={primaryButtonClasses}
        >
          Adicionar
        </button>

        <label htmlFor={FILE_INPUT_ID} className={secondaryButtonClasses}>
          {importing ? "Importando…" : "Carga masiva"}
        </label>

        <span className="text-sm text-zinc-600">
          {applicants.length} de {MAX_APPLICANTS} personas
        </span>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="roster-title"
        onClose={() => {
          onOpenChange(false);
          closeEditor();
        }}
        className="m-auto max-h-[85vh] w-[min(60rem,92vw)] rounded-2xl border border-zinc-200 bg-white p-0 text-left shadow-2xl backdrop:bg-zinc-900/50"
      >
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4">
            <div>
              <h2
                id="roster-title"
                className="text-base font-semibold text-zinc-900"
              >
                Solicitantes
              </h2>
              <p className="mt-0.5 text-sm text-zinc-600">
                {applicants.length} de {MAX_APPLICANTS} personas · máximo{" "}
                {MAX_APPLICANTS} por solicitud
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Cerrar"
            >
              <svg
                className="size-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => openEditor(null)}
                disabled={atLimit}
                className={primaryButtonClasses}
              >
                Añadir persona
              </button>

              <button
                type="button"
                onClick={() => void exportRoster()}
                className={secondaryButtonClasses}
              >
                Exportar
              </button>

              <label
                htmlFor={FILE_INPUT_ID}
                className={`${secondaryButtonClasses} ${
                  importing ? "pointer-events-none opacity-60" : ""
                }`}
              >
                {importing ? "Importando…" : "Importar"}
              </label>

              <span className="text-xs text-zinc-500">
                El fichero debe traer las cinco columnas.
              </span>
            </div>

            {notice && (
              <div
                role="alert"
                className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                  notice.tone === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
                }`}
              >
                <p className="font-medium">{notice.headline}</p>
                {notice.rows.length > 0 && (
                  <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs">
                    {notice.rows.map((row, index) => (
                      <li key={`${row.fila}-${index}`}>
                        Fila {row.fila}: {row.mensaje}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {rosterErrors.length > 0 && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <ul className="space-y-0.5">
                  {rosterErrors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            )}

            {editorOpen && (
              <RosterEditor
                draft={draft}
                draftErrors={draftErrors}
                serverErrors={
                  editingIndex === null
                    ? undefined
                    : FIELDS.reduce<Record<string, string>>((acc, field) => {
                        const message = serverError(editingIndex, field.key);
                        if (message) {
                          acc[field.key] = message;
                        }
                        return acc;
                      }, {})
                }
                editing={editingIndex !== null}
                onChange={setDraft}
                onSave={saveApplicant}
                onCancel={closeEditor}
              />
            )}

            {applicants.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500">
                Todavía no hay solicitantes. Añade una persona o importa un
                fichero con la lista.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">
                        #
                      </th>
                      {FIELDS.map((field) => (
                        <th
                          key={field.key}
                          scope="col"
                          className="px-4 py-3 font-medium"
                        >
                          {field.label}
                        </th>
                      ))}
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-medium"
                      >
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {applicants.map((applicant, index) => (
                      <tr key={`${index}-${applicant.idNumber}`}>
                        <td className="px-4 py-3 text-zinc-500">{index + 1}</td>
                        {FIELDS.map((field) => (
                          <td key={field.key} className="px-4 py-3 text-zinc-800">
                            {applicant[field.key]}
                            {serverError(index, field.key) && (
                              <p className="mt-0.5 text-xs font-medium text-red-600">
                                {serverError(index, field.key)}
                              </p>
                            )}
                          </td>
                        ))}
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openEditor(index)}
                            className="text-sm font-medium text-indigo-600 underline-offset-2 hover:text-indigo-700 hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => removeApplicant(index)}
                            className="ml-3 text-sm font-medium text-rose-600 underline-offset-2 hover:text-rose-700 hover:underline"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <footer className="flex justify-end border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={`${buttonClasses} bg-zinc-900 text-white hover:bg-zinc-700`}
            >
              Cerrar
            </button>
          </footer>
        </div>
      </dialog>
    </>
  );
}

/** Alta y edición de una persona: los mismos cinco campos, en cliente y servidor. */
function RosterEditor({
  draft,
  draftErrors,
  serverErrors,
  editing,
  onChange,
  onSave,
  onCancel,
}: {
  draft: Applicant;
  draftErrors: Record<string, string>;
  serverErrors?: Record<string, string>;
  editing: boolean;
  onChange: (next: Applicant) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mb-5 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
      <h3 className="text-sm font-semibold text-zinc-900">
        {editing ? "Editar persona" : "Nueva persona"}
      </h3>

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => {
          const error = draftErrors[field.key] ?? serverErrors?.[field.key];
          const id = `applicant-${field.key}`;

          return (
            <div key={field.key} className="flex flex-col gap-1.5">
              <label
                htmlFor={id}
                className="text-sm font-medium text-zinc-700"
              >
                {field.label}
                <span className="text-red-500"> *</span>
              </label>
              <input
                id={id}
                type={field.type}
                value={draft[field.key]}
                onChange={(event) =>
                  onChange({ ...draft, [field.key]: event.target.value })
                }
                className={error ? errorInputClasses : inputClasses}
              />
              {error && (
                <p className="text-xs font-medium text-red-600">{error}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex justify-end gap-3">
        <button type="button" onClick={onCancel} className={secondaryButtonClasses}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSave}
          className={primaryButtonClasses}
        >
          {editing ? "Guardar cambios" : "Añadir a la relación"}
        </button>
      </div>
    </div>
  );
}
