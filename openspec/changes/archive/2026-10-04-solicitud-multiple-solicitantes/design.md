## Context

El formulario público (`components/contact-form.tsx`) es un único `<form>` que envía a una Server Action (`app/actions/request-signature.ts`). El Server Action valida con zod (`lib/validation.ts`), persiste mediante `createRequest` (`data/requests.ts`) y a continuación envía un correo de aviso best-effort (`lib/email.ts`). Ese orden —persistencia primero, correo después— es deliberado y ya está fijado en el diseño del cambio `admin-dashboard`: un fallo de SMTP nunca pierde una solicitud.

El panel de administración (`app/admin/**`) lista, filtra, exporta a CSV y muestra la ficha de cada solicitud, todo ello a través del DAL de `data/requests.ts`, que es el único módulo que habla con la base de datos.

Restricciones heredadas del repositorio que condicionan este diseño:

- **SQLite** vía Prisma 7. No hay tipos enumerados: `status`, `certificateType` y `documentType` son `String` y la validez la garantiza zod. Cualquier campo enumerado nuevo sigue ese patrón.
- **El DAL es la única capa de acceso a datos.** Las Server Actions y los Route Handlers son finos y delegan en `data/requests.ts`.
- **El despliegue del esquema en Turso es manual.** `scripts/db-turso-migrate.ts` falla a propósito cuando `prisma/schema.prisma` ha cambiado desde la última aplicación, para que alguien revise el SQL. Ninguna migración puede darse por aplicada automáticamente.
- No hay librería de componentes de UI, ni de modales, ni de hojas de cálculo, ni framework de tests. Solo Tailwind para estilos.

## Goals / Non-Goals

**Goals:**

- Capturar una relación de solicitantes cuando el firmante no es una sola persona, y que llegue intacta hasta el correo.
- Sustituir los campos que no aportan (Cargo, tipo/número de documento, país de residencia, tipo de certificado) y corregir el identificador de empresa a Código REEUP.
- Hacer *round-trip* de esa relación con una hoja de cálculo, sin teclearla a mano.
- Mantener intactas las garantías ya construidas: persistencia antes que correo, fallo de correo no bloqueante, y validación en servidor como única fuente de verdad.

**Non-Goals:**

- Managed los certificados emitidos ni el ciclo de vida de cada firmante. La relación es una captura de datos, no un alta de certificados.
- Envío de correo a los solicitantes. Solo se adjunta el fichero al aviso interno.
- Cualquier cosa del flujo de estados, del historial, de la autenticación del panel o de la configuración de la base de datos.
- Migrar a un motor con enumerados reales.

## Decisions

### D1 — La relación de solicitantes es una tabla, no una columna JSON

Se añade el modelo `RequestApplicant` con `requestId` como clave ajena a `SignatureRequest`, `onDelete: Cascade` e índice por `requestId`. Sus campos son `fullName`, `idNumber`, `address`, `email` y `phone`, más `position` para conservar el orden en que seoguideron.

La alternativa era una columna JSON en `signature_requests`. Se descarta porque el panel necesita *contar* los solicitantes por solicitud, mostrarlos en la ficha y, en el futuro, filtrar el listado por el nombre de un empleado. Consultar un JSON con `contains` no es indexable y obligaría a traer la fila entera para contar. El coste es una tabla más y una escritura anidada; se asume.

`onDelete: Cascade` replica lo que ya hace `RequestStatusEvent`.

### D2 — La migración reconstruye la tabla; el histórico de identidad se pierde

Retirar `position`, `documentType`, `documentNumber` y `country` exige reconstruir `signature_requests`: las cuatro son `NOT NULL` sin valor por defecto y SQLite rechaza `DROP COLUMN` sobre ellas. La migración crea la tabla nueva con el esquema definitivo, copia las columnas que sobreviven, descarta la tabla antigua y renombra. `nif` se renombra a `reeupCode` en esa misma copia, lo que preserva los identificadores ya capturados.

Se añade además `businessName`, `personalAddress` y `personalIdNumber`, y `signerMode`. Las columnas nuevas se crean directamente con la nulabilidad definitiva: `businessName` obligatoria, `personalAddress` opcional, `personalIdNumber` opcional en base de datos pero obligatoria por validación cuando el modo es `personal` (D3).

Es una migración **destructiva**: las solicitudes ya registradas pierden su cargo, su tipo y número de documento y su país de residencia. Son datos que el nuevo formulario deja de pedir y que no se pueden recuperar. Antes de aplicarla hay que hacer una copia de la base de datos, y la migración en Turso se revisa y aplica a mano como manda la política del proyecto. No habrá migración de reversión: la vuelta atrás exige restaurar la copia.

### D3 — `signerMode` es un `String` validado por zod, y la validación es un unión discriminada

Por coherencia con lo ya decidido para `status`, `certificateType` y `documentType`, `signerMode` se almacena como `String` con valores `personal` y `multiple`.

El schema de `lib/validation.ts` pasa a ser una unión discriminada sobre `signerMode`, no un objeto plano. Eso traslada al servidor la invariante que de otro modo solo existiría en la interfaz:

- `personal` exige `personalIdNumber` con formato de carnet y **no** admite relación de solicitantes.
- `multiple` exige `personalIdNumber` ausente y **al menos un** solicitante.

La consecuencia pretendida es que una URL manipulada o un `POST` a mano no puedan crear una solicitud en modo `multiple` sin relación, ni una en modo `personal` con relación. El radio button sigue controlando qué se ve en pantalla, pero la verdad es el schema.

El carnet de identidad en modo `personal` vive en «Datos personales» y no en el modal: es un solo firmante, no una relación que gestionar, y meterlo en el modal obligaría a abrirlo para algo que cabe en un campo.

### D4 — La relación viaja al servidor como un único campo oculto con JSON

El modal es estado de cliente. Para que la Server Action reciba la relación sin una segunda ida y vuelta, el componente la serializa a JSON en un `<input type="hidden" name="applicants">`, y el schema la parsea con `z.array(applicantSchema).max(MAX_APPLICANTS)`.

Se descartan las alternativas:

- **Un input por solicitante** (`applicants[0].fullName`, …): obliga a aplanar y reagrupar en el servidor, y no admite filas con huecos.
- **Una Server Action aparte para guardar la relación**: parte la transacción en dos. Si la relación se guardara primero y la solicitud fallara, quedarían filas huérfanas; si fuera al revés, la solicitud sin firmantes ya habría pasado la validación.

El límite `MAX_APPLICANTS = 200` protege el tamaño del cuerpo de la Server Action (Next.js acepta 1 MB por defecto) y el tiempo de la transacción. Una relación de 200 personas ronda los 40 KB de JSON, muy por debajo.

Tras un error de validación el JSON vuelve en el estado de la acción, así que el modal se rehidrata con lo que el visitante ya había tecleado en lugar de vaciarse. Para eso `flattenIssues` deja de usar `issue.path[0]` y pasa a `issue.path.join(".")`, de modo que los errores de un solicitante llegan como `applicants.3.email` y el modal los pinta en la fila que los originó.

### D5 — `exceljs`, solo en servidor, y el import es un endpoint

Se añade `exceljs@4.4.0` (MIT) como única dependencia nueva. Lee y escribe tanto `.xlsx` como `.csv`, así que un solo módulo cubre los dos sentidos.

Se descarta **`xlsx` (SheetJS)**: la versión que npm tiene publicada está clavada en `0.18.5` y arrastra avisos de seguridad conocidos; las correcciones viven en un CDN aparte. No es una dependencia que convenga introducir en un formulario público.

Se descarta **analizar el fichero en el navegador**: `exceljs` pesa lo suficiente como para que meterlo en el bundle del cliente penalice a quien solo quiere pedir un certificado personal. Por eso el import es un Route Handler: el `<input type="file">` del modal hace `POST` multipart, el servidor parsea y devuelve las filas ya validadas en JSON. El cliente nunca ve la librería.

La consecuencia es que el estado de «importando…» es asíncrono y hay que distinguir error de red de error de contenido: un `413` por fichero demasiado grande y un `422` con filas inválidas se muestran de forma distinta.

El módulo se importa con `await import("exceljs")` dentro de las funciones, no en el tope del módulo, para que el coste se paga solo en las peticiones que importan o exportan y no en el arranque del servidor.

### D6 — La neutralización de fórmulas se reutiliza tal cual en el xlsx

`lib/csv.ts` ya tiene `sanitizeCell()`, que antepone un apóstrofo a los valores que empiezan por `=`, `+`, `-` o `@` para que una hoja de cálculo no los ejecute. Ese riesgo es idéntico en xlsx —una celda cuyo texto empieza por `=` se convierte en fórmula— y la función se reutiliza sin cambios en la construcción del libro. Así los dos formatos se comportan igual y no aparece una segunda lista de caracteres peligrosos que mantener al día.

`lib/csv.ts` conserva su rol: el CSV de las **solicitudes** que exporta el panel. El libro de **solicitantes** que se adjunta al correo es otro formato y otro módulo.

### D7 — Un solo libro para el adjunto del correo y para la descarga

`buildRosterWorkbook(applicants)` devuelve un `Buffer` en memoria. Lo usan dos llamadores: el Route Handler que sirve la descarga del modal y `sendRequestEmail`, que lo adjunta con `{ filename, content, contentType }` de nodemailer.

Generarlo una sola vez garantiza que el fichero que recibe el comercial por correo es byte a byte el mismo que el que el visitante puede descargar, y que una corrección de formato no se aplica a un camino y se olvida en el otro.

El correo solo se adjunta en modo `multiple`. En modo `personal` el aviso sale como hoy, sin adjuntos. El orden persistencia → correo no cambia: si generar o adjuntar el libro falla, la solicitud ya está guardada y se registra el fallo con `recordNotificationResult`, igual que un fallo de SMTP.

### D8 — El modal es un `<dialog>` nativo

No hay librería de UI en el proyecto y no se va a introducir una solo para esto. `<dialog>` con `showModal()` aporta de forma nativa el foco atrapado, el cierre con `Escape` y `::backdrop`, que es el 90% de lo que hace un modal accesible.

Es un componente de cliente con `useState`. La CFR es que el flujo —radio, botones, modal— requiere JavaScript: sin él el formulario se enviaría sin relación y el servidor lo rechazaría con un error de validación. Se acepta: la función es inherentemente interactiva y el mensaje de error es accionable.

### D9 — El panel intercambia el filtro y las métricas por tipo de certificado

`certificateType` desaparece, así que `RequestFilters.certificateType` pasa a ser `signerMode` con los mismos valores validados, `byCertificateType` en las métricas pasa a `bySignerMode`, y los componentes del panel cambian la etiqueta del desplegable.

Dos cambios adicionales que no pediste explícitamente pero que dejan el panel coherente, y que son una línea cada uno:

- La búsqueda libre pasa a cubrir `businessName` y `reeupCode` (hoy cubre `nif`), porque son los campos por los que se busca con el modelo nuevo.
- La búsqueda también alcanza a los solicitantes mediante `applicants: { some: { fullName: { contains } } }`. Sin esto no hay forma de encontrar la solicitud de una empresa a partir del nombre de un empleado, que es justo la pregunta que aparece cuando llega una llamada de «mi certificado no está».

La ficha de detalle muestra la relación en una tarjeta propia, con el contador de solicitantes en el encabezado.

### D10 — Duplicados en la relación son un error, no una línea que se descarta

Al validar la relación se rechazan dos solicitantes con el mismo `idNumber`, comparando sin distinguir mayúsculas ni espacios. Descartar en silencio a una persona de una lista de firma es peor que frenar el envío: el comercial descubriría el hueco al emitir. El error se devuelve por fila, apuntando a la que repite.

## Risks / Trade-offs

- **Se pierde el histórico de identidad y cargo** de las solicitudes ya registradas → Copia de la base de datos antes de aplicar, en local y en Turso. La migración se revisa a mano, como ya exige el comando de despliegue. Sin copia no hay vuelta atrás.
- **Coste de `exceljs` en el servidor** → Importación dinámica dentro de las funciones; el arranque del proceso y el resto de rutas no lo pagan. El Cold Start de las dos rutas que sí lo usan es algo mayor, y es un coste aceptable a cambio de sacarlo del bundle del cliente.
- **Filas de hasta 200 personas** en una transacción y en un correo → Límite duro en el schema. El correo con 200 filas es grande pero admisible para SMTP; si en la práctica molesta, el límite se baja sin tocar el diseño.
- **Un `.xlsx` manipulado** podría intentar agotar la memoria al descomprimirse → Se fija un tope de tamaño de fichero antes de leerlo, y el Route Handler del import rechaza por encima de él. Ningún dato de la petición se guarda sin pasar por zod.
- **El cuerpo de la Server Action** tiene tope de 1 MB → `MAX_APPLICANTS` deja el peor caso muy por debajo (≈40 KB).
- **Sin JavaScript no se puede capturar la relación**, porque el flujo radio → botones → modal no existe → El servidor rechaza la solicitud en modo `multiple` sin relación con un mensaje claro, en lugar de aceptarla incompleta.
- **La búsqueda sobre solicitantes** añade una subconsulta al listado → Solo cuando hay texto de búsqueda, que es el caso minoritario, y sobre una columna indexada. El listado paginado acota el resultado.

## Migration Plan

1. Escribir el `schema.prisma` definitivo y generar el cliente.
2. `pnpm db:migrate` en local contra `data/app.db`: produce el SQL de reconstrucción. **Releerlo a mano** antes de aplicarlo — es el paso que el propio `db-turso-migrate.ts` exige.
3. Copia de `data/app.db` antes de aplicarla, y copia de Turso antes del paso 5.
4. Aplicar en local y comprobar con `pnpm typecheck` y `pnpm lint` que ninguna referencia a los campos retirados sobrevive.
5. Aplicar el mismo SQL en Turso a mano, tras la copia.
6. Desplegar.

**Reversión:** no hay migración de bajada. Antes del paso 5, restaurar la copia de Turso y desplegar el commit anterior.

## Open Questions

- **Formato exacto del Código REEUP.** No se ha podido confirmar el formato (longitud, si admite letras) ni su denominación oficial. De momento se valida solo como cadena no vacía de longitud mínima razonable, igual que hacía `nif`. Si hay un patrón conocido, conviene añadir su `zod` en `lib/validation.ts`.
- **Si «Nombre de la empresa» y «Razón social» son realmente dos campos distintos.** Se han añadido los dos porque el encargo dice «adicionar» el nombre de la empresa y no «renombrar» la razón social. Si en realidad es el mismo dato con otro nombre, uno de los dos sobra y se elimina.
- **Necesidades del panel** sobre el formato de la relación: si el comercial necesita reordenar, marcar duplicados o ver un resumen antes de enviar, el modal crece. Este diseño solo cubre alta, edición, baja, importación y exportación.