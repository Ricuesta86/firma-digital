import { z } from "zod";

export const documentTypes = ["DNI", "NIE", "Pasaporte"] as const;

export const certificateTypes = [
  "Firma cualificada",
  "Firma avanzada",
  "Certificado de sello de empresa (CSE)",
  "Certificado digital de empleado público",
] as const;

export const requestSchema = z.object({
  fullName: z.string().trim().min(2, "Introduce tu nombre completo"),
  email: z.email("Introduce un email válido"),
  phone: z.string().trim().min(6, "Introduce un teléfono válido"),
  companyName: z.string().trim().min(2, "Introduce la razón social"),
  nif: z.string().trim().min(5, "Introduce un NIF/CIF válido"),
  address: z.string().trim().optional(),
  position: z.string().trim().min(2, "Introduce tu cargo en la empresa"),
  documentType: z.enum(documentTypes, {
    error: "Selecciona un tipo de documento",
  }),
  documentNumber: z.string().trim().min(3, "Introduce el número del documento"),
  country: z.string().trim().min(2, "Introduce tu país de residencia"),
  certificateType: z.enum(certificateTypes, {
    error: "Selecciona el tipo de certificado",
  }),
  message: z.string().trim().max(2000).optional(),
  privacyConsent: z
    .boolean()
    .refine((value) => value === true, {
      message: "Debes aceptar la política de privacidad",
    }),
});

export type RequestPayload = z.infer<typeof requestSchema>;