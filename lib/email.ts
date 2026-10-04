import nodemailer from "nodemailer";

import {
  buildRosterFilename,
  buildRosterWorkbook,
  rosterContentType,
} from "@/lib/spreadsheet";
import { signerModeLabels, type RequestPayload } from "@/lib/validation";

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string;
};

export function getSmtpConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  const to = process.env.CONTACT_EMAIL;

  if (!host || !from || !to) {
    throw new Error(
      "FALTAN_VARIABLES_SMTP: define SMTP_HOST, SMTP_FROM y CONTACT_EMAIL en .env.local",
    );
  }

  return { host, port, user: user ?? "", pass: pass ?? "", from, to };
}

type MultiplePayload = Extract<RequestPayload, { signerMode: "multiple" }>;

/** Guardia de tipo: en modo múltiple la relación siempre existe. */
function isMultiple(payload: RequestPayload): payload is MultiplePayload {
  return payload.signerMode === "multiple";
}

/**
 * La lista de campos vive en una función para que el HTML y el texto plano no
 * puedan quedar desfasados entre sí: ambos la consumen.
 */
function buildRows(payload: RequestPayload): Array<[string, string]> {
  return [
    ["Nombre completo", payload.fullName],
    ["Email", payload.email],
    ["Teléfono", payload.phone],
    ["Dirección", payload.personalAddress ?? "—"],
    [
      "Número de carnet de identidad",
      payload.personalIdNumber ?? "— (se pide por cada solicitante)",
    ],
    ["Razón social", payload.companyName],
    ["Nombre de la empresa", payload.businessName],
    ["Código REEUP", payload.reeupCode],
    ["Dirección de la empresa", payload.address ?? "—"],
    [
      "Modo de firmante",
      `${signerModeLabels[payload.signerMode]}${
        isMultiple(payload)
          ? ` (${payload.applicants.length} solicitantes en el adjunto)`
          : ""
      }`,
    ],
    ["Mensaje", payload.message ?? "—"],
  ];
}

function buildHtmlBody(payload: RequestPayload): string {
  const htmlRows = buildRows(payload)
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;white-space:nowrap">${label}</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${value}</td></tr>`,
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827">
      <h2 style="color:#4f46e5">Solicitud de firma digital</h2>
      <p>Se ha recibido una nueva solicitud de certificado digital:</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">${htmlRows}</table>
      <p style="color:#6b7280;font-size:12px;margin-top:24px">Correo generado automáticamente desde firma-digital.</p>
    </div>
  `;
}

function buildTextBody(payload: RequestPayload): string {
  return [
    "Nueva solicitud de firma digital",
    "--------------------------------",
    ...buildRows(payload).map(([label, value]) => `${label}: ${value}`),
  ].join("\n");
}

/**
 * Adjunto con la relación de solicitantes, solo en modo «varias personas».
 *
 * El libro lo genera el mismo `buildRosterWorkbook` que sirve la descarga del
 * modal, así que el fichero del correo y el descargable son el mismo
 * (design.md D7). Cualquier fallo al generarlo o enviarlo sube como excepción y
 * lo captura el `catch` best-effort de la Server Action, que registra el fallo
 * de notificación sin perder la solicitud ya persistida.
 */
async function buildRosterAttachment(
  payload: RequestPayload,
): Promise<{ filename: string; content: Buffer; contentType: string }[]> {
  if (!isMultiple(payload)) {
    return [];
  }

  const content = await buildRosterWorkbook(payload.applicants);

  return [
    {
      filename: buildRosterFilename(),
      content,
      contentType: rosterContentType(),
    },
  ];
}

export async function sendRequestEmail(
  payload: RequestPayload,
): Promise<void> {
  const config = getSmtpConfig();

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth:
      config.user && config.pass
        ? { user: config.user, pass: config.pass }
        : undefined,
  });

  const attachments = await buildRosterAttachment(payload);

  await transporter.sendMail({
    from: config.from,
    to: config.to,
    replyTo: payload.email,
    subject: `Solicitud de firma digital — ${payload.fullName}`,
    html: buildHtmlBody(payload),
    text: buildTextBody(payload),
    // Sin adjuntos en modo «Personal»: el aviso sale tal cual, como antes.
    ...(attachments.length > 0 ? { attachments } : {}),
  });
}
