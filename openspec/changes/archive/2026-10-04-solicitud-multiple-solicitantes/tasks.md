## 1. Copia de seguridad y dependencias

- [x] 1.1 Copia de `data/app.db` antes de tocar el esquema, y anotar dónde está para poder volver atrás (D2)
- [x] 1.2 `pnpm add exceljs` y confirmar que `package.json` lo deja en `dependencies` (D5)
- [x] 1.3 Verificar con `node -e` que `exceljs` se importa en el runtime de Node sin errores, antes de escribir código que dependa de él (D5)

## 2. Esquema de datos y migración

- [x] 2.1 Anadir a `prisma/schema.prisma` el modelo `RequestApplicant` con `requestId` como clave ajena, `onDelete: Cascade`, `@@index([requestId])` y los campos `fullName`, `idNumber`, `address`, `email`, `phone` y `position` (D1)
- [x] 2.2 Añadir la relación inversa `applicants RequestApplicant[]` en `SignatureRequest` (D1)
- [x] 2.3 En `SignatureRequest`: renombrar `nif` a `reeupCode` y añadir `businessName` (obligatorio), `personalAddress` (opcional), `personalIdNumber` (opcional) y `signerMode` (por defecto `personal`) (D2, D3)
- [x] 2.4 Eliminar de `SignatureRequest` las columnas `position`, `documentType`, `documentNumber`, `country` y `certificateType` (D2)
- [x] 2.5 Actualizar el comentario de cabecera de `schema.prisma`, que hoy justifica que `certificateType` y `documentType` sean `String`, para que nombre solo `signerMode` (D3)
- [x] 2.6 `pnpm db:generate` y `pnpm db:migrate` contra la base local, y **releer el SQL generado a mano** antes de aplicarlo: la migración reconstruye la tabla y es destructiva (D2)
- [x] 2.7 Comprobar que el SQL copia `nif` a `reeupCode` sin perder los identificadores ya registrados (D2)

## 3. Validación

- [x] 3.1 En `lib/validation.ts`, declarar `signerModes = ["personal", "multiple"]` y `MAX_APPLICANTS = 200` (D3, D4)
- [x] 3.2 Definir `applicantSchema` con los cinco campos, sin `documentType` ni `position`, reutilizando las reglas de formato ya usadas para correo y teléfono (D3)
- [x] 3.3 Añadir la comprobación de carnets duplicados que.compare sin distinguir mayúsculas ni espacios y apunte a la fila que repite (D10)
- [x] 3.4 Convertir `requestSchema` en `z.discriminatedUnion("signerMode", …)`: la rama `personal` exige `personalIdNumber` y prohíbe la relación; la rama `multiple` exige la relación y prohíbe `personalIdNumber` (D3)
- [x] 3.5 Retirar de `lib/validation.ts` las constantes `documentTypes` y `certificateTypes`, y su reexportación en `data/requests.ts` (D3)
- [x] 3.6 Cambiar `flattenIssues` en `app/actions/request-signature.ts` para usar `issue.path.join(".")` en lugar de `issue.path[0]`, de forma que los errores de un solicitante lleguen como `applicants.3.email` (D4)

## 4. Capa de datos

- [x] 4.1 Actualizar `RequestPayload` y derivarlo del nuevo `requestSchema` (D3)
- [x] 4.2 Actualizar `createRequest` en `data/requests.ts`: campos nuevos, `signerMode`, y creación anidada de los solicitantes en la misma transacción (D1)
- [x] 4.3 Añadir a `data/requests.ts` los DTO de solicitante y exponer la relación en `RequestDetailDto` y en `RequestListDto` como contador, sin traer las filas en el listado (D1)
- [x] 4.4 Añadir una función de lectura que devuelva la relación de una solicitud, reutilizada por la ficha de detalle y por el listado cuando haga falta (D1)
- [x] 4.5 Cambiar `RequestFilters.certificateType` por `signerMode` en `parseRequestFilters` y en `buildWhere` (D9)
- [x] 4.6 Ampliar `buildWhere` para que la búsqueda libre abarque `businessName`, `reeupCode` y los solicitantes con `applicants: { some: { fullName: { contains } } }` (D9)
- [x] 4.7 Cambiar `getMetrics` para que agrupe por `signerMode` en lugar de `certificateType`, y renombrar `byCertificateType` a `bySignerMode` (D9)
- [x] 4.8 Ajustar los `select` de `getRequests`, `getRequestById` y `getRequestsForExport` al conjunto de campos nuevo (D2)

## 5. Hoja de cálculo de solicitantes

- [x] 5.1 Crear `lib/spreadsheet.ts` con `buildRosterWorkbook(applicants)` que devuelva un `Buffer` en memoria, importando `exceljs` con `await import()` dentro de la función (D5)
- [x] 5.2 En esa función, escribir una fila de cabecera con los cinco datos de solicitante y una fila por persona, reutilizando `sanitizeCell` de `lib/csv.ts` para neutralizar fórmulas también en el xlsx (D6)
- [x] 5.3 Añadir en el mismo módulo `parseRosterWorkbook(buffer, filename)` que detecte `.xlsx` o `.csv` por extensión, rechace por encima de `MAX_UPLOAD_BYTES` antes de leer, y parsee con `exceljs` (D5)
- [x] 5.4 Validar cada fila con `applicantSchema` y devolver `{ filas, errores }` con el error asociado a su número de fila (D5)
- [x] 5.5 Añadir la comprobación de cabecera: si falta alguna de las cinco columnas, rechazar indicando cuáles (D5)
- [x] 5.6 Nombre de fichero `solicitantes-<marca de tiempo>.xlsx` para que identifique contenido y fecha (D5)

## 6. Endpoints de la relación

- [x] 6.1 `app/api/roster/export/route.ts`: `GET` que devuelve el `.xlsx` como adjunto, sin sesión, porque lo consume el propio visitante del formulario público (D5)
- [x] 6.2 `app/api/roster/import/route.ts`: `POST` multipart que devuelve las filas validadas en JSON; `413` por tamaño y `422` por filas inválidas, con motivos distintos en el mensaje (D5)
- [x] 6.3 El endpoint de import no persiste nada por sí mismo: solo valida y devuelve filas (D5)

## 7. Correo

- [x] 7.1 En `lib/email.ts`, sustituir `["Cargo", …]`, `["NIF/CIF", …]`, `["Tipo de documento", …]`, `["Número de documento", …]`, `["País de residencia", …]` y `["Certificado solicitado", …]` por los campos nuevos, añadir «Nombre de la empresa», «Código REEUP», «Dirección» y «Número de carnet de identidad», e incluir el modo de firmante legible (D2)
- [x] 7.2 Actualizar también `buildTextBody`, que hoy duplica la lista de campos, para que no se quede desfasada (D2)
- [x] 7.3 Añadir el adjunto con `buildRosterWorkbook` solo cuando el modo sea `multiple`; en modo `personal`, el aviso sale sin adjuntos (D7)
- [x] 7.4 Comprobar que el fallo al generar o adjuntar el libro cae en el mismo `catch` best-effort que ya registra `recordNotificationResult`, y no en un `catch` aparte (D7)

## 8. Acción de envío

- [x] 8.1 En `app/actions/request-signature.ts`, dejar de leer `position`, `documentType`, `documentNumber`, `country` y `certificateType`, y leer `businessName`, `reeupCode`, `personalAddress`, `personalIdNumber` y `signerMode` (D3)
- [x] 8.2 Leer la relación del campo oculto `applicants`, parsear el JSON con `zod` y devolver un error de validación si el JSON está malformado, sin lanzar (D4)
- [x] 8.3 Reponer la relación en el estado devuelto para que el modal se rehidrate tras un error de validación (D4)

## 9. Interfaz del formulario

- [x] 9.1 `components/contact-form.tsx`: en «Datos personales», añadir el campo Dirección y el campo Número de carnet de identidad (D3)
- [x] 9.2 En «Datos de la empresa», añadir «Nombre de la empresa», renombrar la etiqueta de `nif` a «Código REEUP» y eliminar el campo Cargo (D2)
- [x] 9.3 Eliminar el `Fieldset` de «Verificación de identidad» completo y el `select` de tipo de certificado de «Solicitud» (D2)
- [x] 9.4 Añadir el grupo de botones de opción «Personal» / «Varias Personas» en «Solicitud», con el carnet visible solo en modo `personal` (D3, D8)
- [x] 9.5 Añadir el campo oculto `applicants` sincronizado con el estado de la relación, para que viaje en el mismo envío (D4)
- [x] 9.6 Mostrar las acciones «Adicionar» y «Carga masiva» únicamente en modo `multiple` (D8)
- [x] 9.7 Pintar los errores por ruta: los de `applicants.N.campo` se muestran dentro del modal, el resto junto a su campo (D4)

## 10. Modal de gestión de solicitantes

- [x] 10.1 Crear `components/applicant-roster-modal.tsx` como componente de cliente sobre `<dialog>` nativo con `showModal()`, `::backdrop` y cierre con `Escape` (D8)
- [x] 10.2 Listado de las personas de la relación con sus cinco datos, en el orden de alta, con acción de editar y de eliminar por fila (D1)
- [x] 10.3 Formulario de alta y edición con los cinco campos y validación en cliente espejando `applicantSchema`, sin ser la única validación (D3)
- [x] 10.4 Botón «Exportar» que descarga el `.xlsx` desde el endpoint de la sección 6 (D5)
- [x] 10.5 Botón «Importar» con `<input type="file" accept=".xlsx,.csv">` que hace `POST` al endpoint de import, con estado de «importando…» (D5)
- [x] 10.6 Distinguir en la interfaz el error de red y de tamaño del error de contenido, y mostrar el número de fila de cada dato inválido (D5)
- [x] 10.7 Mostrar el contador de personas y el límite máximo en la cabecera del modal (D3)

## 11. Panel de administración

- [x] 11.1 `components/admin/request-filters.tsx`: sustituir el desplegable de tipo de certificado por el de modo de firmante, y su parámetro en la URL (D9)
- [x] 11.2 `components/admin/requests-table.tsx`: mostrar el Código REEUP en lugar del NIF y el modo de firmante en lugar del tipo de certificado (D9)
- [x] 11.3 `components/admin/metrics-cards.tsx`: reparto por modo de firmante (D9)
- [x] 11.4 `app/admin/requests/[id]/page.tsx`: retirar las tarjetas de «Verificación de identidad» y el campo Cargo, añadir «Nombre de la empresa», «Código REEUP», la dirección y el carnet de identidad (D2)
- [x] 11.5 En esa misma ficha, añadir la tarjeta de solicitantes con el contador y los cinco datos de cada persona, o el aviso de que no hay relación en modo `personal` (D1)
- [x] 11.6 `lib/csv.ts`: actualizar `CSV_COLUMNS` y `CSV_HEADERS` al conjunto nuevo, conservando `sanitizeCell` intacto (D6)
- [x] 11.7 `app/admin/page.tsx`: alinear la condición de «hay filtros activos» con el nuevo parámetro (D9)

## 12. Verificación

- [x] 12.1 `pnpm typecheck` y `pnpm lint` en verde, sin referencias a los campos retirados
- [x] 12.2 `grep` sobre `app/`, `components/`, `lib/`, `data/` y `prisma/` confirmando que no queda ninguna referencia a `position`, `documentType`, `documentNumber`, `country` ni `certificateType`
- [x] 12.3 Recorrido manual del formulario en modo `personal`: envío correcto y correo sin adjuntos
- [x] 12.4 Recorrido manual en modo `multiple`: alta, edición y baja en el modal; envío con adjuntos; comprobar que el adjunto y el descargable coinciden
- [x] 12.5 Round-trip: exportar el `.xlsx`, editarlo, importarlo y comprobar que la relación se recupera
- [x] 12.6 Importar un `.csv` válido y uno con filas inválidas, comprobando que el error señala la fila
- [x] 12.7 Enviar en modo `multiple` con la relación vacía, y comprobar que el servidor lo rechaza
- [x] 12.8 Provocar un error de validación con la relación ya rellena y comprobar que el modal la rehidrata
- [x] 12.9 Confirmar que un valor que empieza por `=` no se ejecuta al abrir el `.xlsx` exportado
- [x] 12.10 En el panel: filtrar por modo de firmante, buscar por código REEUP y por el nombre de un solicitante, y comprobar la ficha con relación

## 13. Despliegue

- [x] 13.1 Copia de la base de datos de Turso antes de aplicar el esquema (D2)
- [x] 13.2 Aplicar a mano el SQL de la migración en Turso, revisado, según exige la política de despliegue del proyecto
- [x] 13.3 `pnpm db:deploy:turso` para confirmar que el esquema queda aplicado y que el comando ya no detecta cambios
- [x] 13.4 Desplegar y comprobar que el formulario público sigue capturando solicitudes en los dos modos