# FirmaDigital

Landing page para la solicitud de emisión de firmas digitales y certificados electrónicos, construida con **Next.js 16**, **TypeScript** y **Tailwind CSS v4**. El formulario de contacto envía la solicitud por correo mediante **Nodemailer** (SMTP).

## Requisitos

- Node.js 20.9+
- pnpm (Package Manager)

## Puesta en marcha

Instala las dependencias:

```bash
pnpm install
```

Configura las variables de entorno copiando el ejemplo:

```bash
cp .env.example .env.local
```

Rellena `.env.local` con tus credenciales SMTP:

| Variable         | Descripción                                              |
| ---------------- | -------------------------------------------------------- |
| `SMTP_HOST`      | Host del servidor SMTP (ej. `smtp.gmail.com`)            |
| `SMTP_PORT`      | Puerto SMTP (`587` TLS, `465` SSL)                       |
| `SMTP_USER`      | Usuario del servidor SMTP                                 |
| `SMTP_PASS`      | Contraseña (en Gmail, usa una "contraseña de aplicación") |
| `SMTP_FROM`      | Remitente de los correos                                  |
| `CONTACT_EMAIL`  | Destinatario de las solicitudes de firma digital          |

> Si falta alguna variable, la aplicación funciona en local pero el envío devuelve un error indicando que falta configuración SMTP.

Arranca el servidor de desarrollo:

```bash
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000). El formulario está en `/#contacto`.

## Scripts

| Comando          | Descripción                                     |
| ---------------- | ----------------------------------------------- |
| `pnpm dev`       | Servidor de desarrollo (Turbopack)              |
| `pnpm build`     | Build de producción                             |
| `pnpm start`     | Sirve el build de producción                    |
| `pnpm lint`      | ESLint                                          |
| `pnpm typecheck` | Comprobación de tipos con `tsc --noEmit`        |

## Estructura

```
app/
  actions/request-signature.ts   Server Action: valida y envía el correo
  layout.tsx                     Metadatos y layout raíz
  page.tsx                       Composición de las secciones
components/
  site-header.tsx                Navegación con anclas
  hero.tsx                       Portada con CTA
  features.tsx                   Beneficios / características
  pricing.tsx                    Planes de precios
  contact-form.tsx               Formulario de solicitud ('use client')
  site-footer.tsx                Pie de página
lib/
  email.ts                       Transporte Nodemailer y render del mensaje
  validation.ts                  Esquema zod compartido
```

## Flujo del formulario

1. El usuario rellena el formulario (datos personales, empresa, verificación de identidad, tipo de certificado y consentimiento RGPD).
2. El cliente valida con HTML nativo y envía mediante una Server Action.
3. El servidor valida el payload con **zod** y devuelve errores por campo si procede.
4. Si es válido, **Nodemailer** envía un correo en HTML y texto plano al destinatario configurado en `CONTACT_EMAIL`.
5. La UI muestra una pantalla de éxito o el error correspondiente.