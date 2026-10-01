# Tasks

## 1. Dependencias y configuración base

- [x] 1.1 Instalar las dependencias fijando la versión estable: `pnpm add @prisma/client@7.10.0 @prisma/adapter-better-sqlite3@7.10.0` y `pnpm add -D prisma@7.10.0`
- [x] 1.2 Verificar que Prisma arranca con la configuración de la v7 (driver adapter + `prisma.config.ts`). Si falla, aplicar el plan B de la sección de Riesgos de `design.md` (fijar Prisma 6) y **anotarlo en el change** antes de continuar
- [x] 1.3 Añadir `data/`, `*.db` y `*.db-journal` a `.gitignore`
- [x] 1.4 Añadir `better-sqlite3` y `@prisma/client` a `serverExternalPackages` en `next.config.ts`, conservando `nodemailer`
- [x] 1.5 Documentar en `.env.example` y en `README.md` las variables `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_SESSION_SECRET`, incluyendo cómo generar el secreto con `openssl rand -base64 32` y la advertencia de que `data/app.db` contiene datos personales sujetos a RGPD
- [x] 1.6 Añadir un script `db:migrate` a `package.json` para ejecutar las migraciones de forma reproducible

## 2. Esquema de datos

- [x] 2.1 Crear `prisma/schema.prisma` con el generador `prisma-client` y `output` explícito, y el modelo `SignatureRequest` con todos los campos del formulario, `status`, `adminNotes`, `notificationSentAt`, `notificationError`, `createdAt`, `updatedAt` e índices por `status`, `certificateType` y `email` (D2: enums como `String`)
- [x] 2.2 Añadir el modelo `RequestStatusEvent` con `fromStatus`, `toStatus`, `note`, `createdAt`, la relación con `SignatureRequest` y `onDelete: Cascade` (requisito de integridad del historial)
- [x] 2.3 Crear `prisma.config.ts` con `defineConfig` apuntando a `prisma/schema.prisma` y a la URL `file:./data/app.db`
- [x] 2.4 Ejecutar `pnpm prisma migrate dev --name init` y comprobar que `data/app.db` se crea
- [x] 2.5 Ejecutar `pnpm prisma generate` y verificar que el cliente se importa desde la ruta generada
- [x] 2.6 Crear `data/db.ts` con el singleton de Prisma (driver adapter + patrón `globalThis` de la documentación de Prisma)

## 3. Dominio: máquina de estados y tipos

- [x] 3.1 Crear `lib/request-status.ts` con los cuatro estados, sus etiquetas en español y la tabla de transiciones permitidas de D6
- [x] 3.2 Implementar `canTransition(from, to)` y un validador zod de estado, con `NEW → ACCEPTED` explícitamente no permitida
- [x] 3.3 Derivar el tipo `RequestStatus` como unión de TypeScript y exponer listas de opciones para los desplegables del panel, reutilizando `documentTypes` y `certificateTypes` de `lib/validation.ts` como única fuente de verdad del dominio

## 4. Autenticación del administrador

- [x] 4.1 Crear `lib/auth.ts` (puro: recibe el secreto y las credenciales esperadas como argumentos) con la creación y verificación de la cookie firmada por HMAC-SHA256 usando Web Crypto (compatible con el runtime Node de `proxy.ts`), payload `{ email, issuedAt, expiresAt }` y caducidad de 8 horas
- [x] 4.2 Implementar la comparación de firmas con `crypto.timingSafeEqual` comprobando antes la longitud de ambos valores
- [x] 4.3 Implementar `verifyCredentials` con comparación en tiempo constante del correo y la contraseña, y un único mensaje de error genérico
- [x] 4.4 Hacer que la ausencia de `ADMIN_SESSION_SECRET` provoque un fallo explícito y una entrada de error, nunca un modo degradado
- [x] 4.5 Crear `data/auth.ts` como DAL de sesión, con `import "server-only"`, exponiendo `getSession()` y `requireAdmin()` (redirige) como único punto de lectura de cookies, y dejando la lectura de `ADMIN_*` en `data/admin-config.ts`

## 5. Capa de acceso a datos (DAL)

- [x] 5.1 Crear `data/requests.ts` con `import "server-only"` como módulo único de acceso a la base de datos de solicitudes
- [x] 5.2 Implementar `getRequests({ q, status, certificateType, page, pageSize })` con búsqueda por `contains` sobre `fullName`, `email`, `companyName` y `nif`, paginación por `skip`/`take` y `count` en la misma transacción (D8)
- [x] 5.3 Validar con zod los parámetros de paginación y filtro, devolviendo valores por defecto ante entradas inválidas en lugar de propagar el error
- [x] 5.4 Implementar `getRequestById` devolviendo la solicitud junto a su historial, con `notFound()` en el Route/Page cuando no exista
- [x] 5.5 Implementar `getMetrics()` con el total, el reparto por estado y el reparto por tipo de certificado
- [x] 5.6 Implementar `createRequest(payload)` para la captura pública
- [x] 5.7 Implementar `updateRequestStatus(id, to, note)` con verificación de la transición y escritura del estado y del evento de historial en una **misma transacción**; si la transición no está permitida, rechazar sin tocar el registro
- [x] 5.8 Implementar `addInternalNote(id, text)` con validación de texto no vacío y longitud máxima
- [x] 5.9 Verificar la sesión dentro de **cada** función del DAL salvo `createRequest`, que es el único punto de entrada público
- [x] 5.10 Definir DTOs explícitos y devolver desde el DAL únicamente los campos que la UI necesita, sin filtrar el registro crudo al cliente

## 6. Captura de solicitudes desde el formulario público

- [x] 6.1 Refactorizar `requestSignature` en `app/actions/request-signature.ts` para que el orden sea validar → persistir → notificar
- [x] 6.2 Devolver el error al visitante si falla la persistencia, sin enviar correo
- [x] 6.3 Tratar el fallo de correo como no bloqueante: registrar `notificationError`, devolver el mensaje de éxito y escribir el error en el log
- [x] 6.4 Registrar `notificationSentAt` cuando el envío funciona
- [x] 6.5 Mantener intactos el tipo `RequestState` y el contrato de `flattenIssues` para no romper `components/contact-form.tsx`
- [x] 6.6 Confirmar que `pnpm lint` y `pnpm typecheck` siguen pasando y que el formulario público conserva su comportamiento observable

## 7. Protección de rutas y página de acceso

- [x] 7.1 Crear `proxy.ts` en la raíz con la función exportada `proxy` (no `middleware.ts`, deprecado en Next 16) y un `matcher` que cubra `/admin/:path*`
- [x] 7.2 Redirigir a `/admin/login` las peticiones sin sesión válida bajo `/admin`, y a `/admin` las peticiones con sesión válida a `/admin/login`
- [x] 7.3 Limitar el Proxy a la redirección: no ejecutar consultas ni ser la única barrera de autorización (D3)
- [x] 7.4 Crear `app/admin/login/page.tsx` con el formulario de acceso y `app/admin/actions.ts` exponiendo las Server Actions de login y logout
- [x] 7.5 Implementar el logout borrando la cookie desde una Server Action, nunca como efecto secundario del renderizado
- [x] 7.6 Verificar que las Server Actions del panel revalidan la sesión internamente y que invocarlas directamente sin cookie no produce ningún cambio

## 8. Interfaz del panel

- [x] 8.1 Crear `app/admin/layout.tsx` con el encabezado compartido, el acceso de cerrar sesión, el enlace de vuelta a la web y la verificación de sesión
- [x] 8.2 Crear `app/admin/page.tsx` con las tarjetas de métricas, el formulario de búsqueda y filtros, y el listado paginado leyendo de `searchParams` con `await` (Next 16)
- [x] 8.3 Marcar las lecturas del panel como dinámicas para que el listado no se sirva desde la caché de rutas
- [x] 8.4 Crear los componentes de `components/admin/`: tabla de solicitudes, badges de estado, tarjetas de métricas, filtros, paginación y línea de tiempo del historial
- [x] 8.5 Filtrar los parámetros de la URL con zod antes de usarlos y reflejar los criterios aplicados en la barra de direcciones
- [x] 8.6 Crear `app/admin/requests/[id]/page.tsx` con la ficha completa, el aviso de notificación fallida, el alta de nota y el selector de cambio de estado
- [x] 8.7 Crear las Server Actions de cambio de estado y de alta de nota, devolviendo solo `{ success, error? }` y llamando a `revalidatePath` tras la operación
- [x] 8.8 Mostrar un estado vacío explicativo cuando no haya solicitudes ni resultados de búsqueda
- [x] 8.9 Comprobar que el panel no enlaza desde la web pública y que su aspecto es coherente con el Tailwind v4 ya configurado

## 9. Exportación CSV

- [x] 9.1 Crear `app/api/admin/export/route.ts` reutilizando la misma función de filtrado que el listado, leyendo los criterios de la query string y validándolos con zod
- [x] 9.2 Verificar la sesión dentro del handler y devolver `401` en JSON si falta, sin redirigir
- [x] 9.3 Generar el CSV con cabecera fija, una fila por solicitud y el mismo orden de columnas de forma estable
- [x] 9.4 Escapar correctamente comas, comillas dobles y saltos de línea en cada valor
- [x] 9.5 Añadir el BOM UTF-8 al principio del fichero para que la hoja de cálculo respete los acentos
- [x] 9.6 Neutralizar los valores que empiezan por `=`, `+`, `-` o `@` para evitar la inyección de fórmulas
- [x] 9.7 Excluir del CSV las notas internas, el historial y el motivo de los fallos de notificación
- [x] 9.8 Devolver el fichero como adjunto con `Content-Type` y `Content-Disposition` con la fecha de generación
- [x] 9.9 Añadir el enlace de descarga al panel, conservando los filtros activos en la URL

## 10. Verificación final

- [x] 10.1 Ejecutar `pnpm lint`, `pnpm typecheck` y `pnpm build` sin errores
- [x] 10.2 Comprobar con `pnpm dev` el ciclo completo: enviar el formulario público, ver la solicitud en el listado, abrir la ficha, cambiar el estado, añadir una nota y verificar el historial
- [x] 10.3 Comprobar la protección: sin sesión, `/admin` redirige; la exportación responde `401`; las Server Actions rechazan la invocación directa
- [x] 10.4 Comprobar la exportación: respectar los filtros, abrir el CSV en una hoja de cálculo y verificar acentos, comas y neutralización de fórmulas
- [x] 10.5 Simular un fallo de SMTP (vaciar las variables en `.env.local`) y confirmar que la solicitud se conserva y el panel muestra el aviso
- [x] 10.6 Comprobar que `data/app.db` no aparece en `git status`
- [x] 10.7 Revisar que ninguna carpeta fuera de `data/` importa el cliente de Prisma o lee las variables `ADMIN_*`
- [x] 10.8 Actualizar el `README.md` con la sección del panel de administración, las variables nuevas, la limitación de una instancia por el fichero SQLite y el procedimiento de copia de seguridad
