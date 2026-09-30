import nodemailer from "nodemailer";
import type { RequestPayload } from "@/lib/validation";

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

function buildHtmlBody(payload: RequestPayload): string {
  const rows: Array<[string, string]> = [
    ["Nombre completo", payload.fullName],
    ["Email", payload.email],
    ["Teléfono", payload.phone],
    ["Razón social", payload.companyName],
    ["NIF/CIF", payload.nif],
    ["Dirección", payload.address ?? "—"],
    ["Cargo", payload.position],
    ["Tipo de documento", payload.documentType],
    ["Número de documento", payload.documentNumber],
    ["País de residencia", payload.country],
    ["Certificado solicitado", payload.certificateType],
    ["Mensaje", payload.message ?? "—"],
  ];

  const htmlRows = rows
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
    `Nombre: ${payload.fullName}`,
    `Email: ${payload.email}`,
    `Teléfono: ${payload.phone}`,
    `Razón social: ${payload.companyName}`,
    `NIF/CIF: ${payload.nif}`,
    `Dirección: ${payload.address ?? "—"}`,
    `Cargo: ${payload.position}`,
    `Tipo de documento: ${payload.documentType}`,
    `Número de documento: ${payload.documentNumber}`,
    `País de residencia: ${payload.country}`,
    `Certificado solicitado: ${payload.certificateType}`,
    `Mensaje: ${payload.message ?? "—"}`,
  ].join("\n");
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

  await transporter.sendMail({
    from: config.from,
    to: config.to,
    replyTo: payload.email,
    subject: `Solicitud de firma digital — ${payload.fullName}`,
    html: buildHtmlBody(payload),
    text: buildTextBody(payload),
  });
}