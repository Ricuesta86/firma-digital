import { z } from "zod";

/**
 * Modo de firmante. `personal` es un único firmante identificado con su carnet
 * de identidad; `multiple` es una relación de solicitantes (design.md D3).
 */
export const signerModes = ["personal", "multiple"] as const;

/** Tope duro de la relación, para no desbordar el cuerpo de la Server Action. */
export const MAX_APPLICANTS = 200;

/** Tope de tamaño de un fichero de relación importado (design.md D5). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Reglas de formato compartidas por la solicitud y por cada solicitante, para
 * que el correo y el teléfono se validen igual en los dos sitios.
 */
const emailField = z.email("Introduce un email válido");
const phoneField = z.string().trim().min(6, "Introduce un teléfono válido");

/**
 * Una persona de la relación de solicitantes.
 *
 * Sin tipo de documento ni posición: el tipo de Carnet de Identidad es el
 * único que pide el formulario, y el orden lo lleva el índice de la fila
 * (design.md D1, D3).
 */
export const applicantSchema = z.object({
  fullName: z.string().trim().min(2, "Introduce el nombre y apellidos"),
  idNumber: z.string().trim().min(3, "Introduce el número de carnet"),
  address: z.string().trim().min(5, "Introduce la dirección"),
  email: emailField,
  phone: phoneField,
});

export type Applicant = z.infer<typeof applicantSchema>;

/**
 * Normaliza un carnet para detectar duplicados: sin distinguir mayúsculas ni
 * espacios. Dos carnets que solo se diferencien en eso son del mismo titular.
 */
function normalizeIdNumber(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

/**
 * La relación no puede traer dos filas con el mismo carnet. Se rechaza en lugar
 * de descartar en silencio a una de las dos personas (design.md D10).
 */
const applicantsField = z
  .array(applicantSchema, {
    error: "Añade al menos un solicitante a la relación",
  })
  .max(MAX_APPLICANTS, `Como máximo se admiten ${MAX_APPLICANTS} solicitantes`)
  .superRefine((applicants, ctx) => {
    const seen = new Map<string, number>();

    applicants.forEach((applicant, index) => {
      const key = normalizeIdNumber(applicant.idNumber);
      const first = seen.get(key);

      if (first === undefined) {
        seen.set(key, index);
        return;
      }

      // El error se sitúa en la fila que repite, no en la primera: quien está
      // corrigiendo ve en qué fila está el duplicado.
      ctx.addIssue({
        code: "custom",
        path: [index, "idNumber"],
        message: `Este carnet ya aparece en la fila ${first + 1} de la relación.`,
      });
    });
  });

/** Campos comunes a los dos modos de firmante. */
const requestBase = {
  fullName: z.string().trim().min(2, "Introduce tu nombre completo"),
  email: emailField,
  phone: phoneField,
  personalAddress: z.string().trim().optional(),
  companyName: z.string().trim().min(2, "Introduce la razón social"),
  businessName: z.string().trim().min(2, "Introduce el nombre de la empresa"),
  reeupCode: z.string().trim().min(3, "Introduce el código REEUP"),
  address: z.string().trim().optional(),
  message: z.string().trim().max(2000).optional(),
  privacyConsent: z
    .boolean()
    .refine((value) => value === true, {
      message: "Debes aceptar la política de privacidad",
    }),
};

/**
 * La solicitud es una unión discriminada por `signerMode`, no un objeto plano:
 * traslada al servidor la invariante de que un firmante personal lleva carnet y
 * no relación, y una relación exige al menos una persona (design.md D3).
 */
export const requestSchema = z.discriminatedUnion(
  "signerMode",
  [
    z.object({
      ...requestBase,
      signerMode: z.literal("personal"),
      personalIdNumber: z
        .string({
          error: "Introduce el número de carnet de identidad",
        })
        .trim()
        .min(3, "Introduce el número de carnet de identidad"),
      applicants: z
        .undefined({
          error:
            "En modo «Personal» no se admite una relación de solicitantes.",
        })
        .optional(),
    }),
    z.object({
      ...requestBase,
      signerMode: z.literal("multiple"),
      personalIdNumber: z
        .undefined({
          error:
            "En modo «Varias Personas» el carnet se pide por cada solicitante.",
        })
        .optional(),
      // Obligatoria, no opcional: una petición manipulada que declare «varias
      // personas» sin relación tiene que fallar (design.md D3).
      applicants: applicantsField.min(
        1,
        "Añade al menos un solicitante a la relación",
      ),
    }),
  ],
  { error: "Selecciona si la firma es para una persona o para varias" },
);

export type RequestPayload = z.infer<typeof requestSchema>;

export const signerModeLabels: Record<(typeof signerModes)[number], string> = {
  personal: "Personal",
  multiple: "Varias Personas",
};

export function isSignerMode(value: unknown): value is (typeof signerModes)[number] {
  return (signerModes as readonly unknown[]).includes(value);
}
