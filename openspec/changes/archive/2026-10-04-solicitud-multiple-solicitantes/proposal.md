## Why

El formulario público está modelado para una sola persona y un tipo de certificado, que es como se vendía el producto cuando se construyó. Las empresas que compran firma digital para su plantilla lo hacen de dos formas distintas —un único firmante o un conjunto de empleados— y el formulario solo admite la primera. Una empresa con doce empleados que rellena el formulario tiene que dar de alta la solicitud, enviar luego su relación por correo y teclearla de nuevo a mano, con el consiguiente riesgo de erratas en datos de identidad que después hay que corregir. Además, el identificador que estas entidades usan es el Código REEUP, no el NIF/CIF que pide el formulario, y la sección «Verificación de identidad» pregunta por un tipo de documento y un país de residencia que no intervienen en la emisión del certificado. While the fields exist, nadie los rellena con información útil y todos ralentizan el envío.

## What Changes

- **BREAKING** Añadir a «Datos personales» un campo **Dirección** y un campo **Número de carnet de identidad**. El carnet solo se exige cuando el firmante es una sola persona; en modo múltiple se pide por cada solicitante.
- Añadir a «Datos de la empresa» el campo **Nombre de la empresa**, que convive con la actual razón social.
- **BREAKING** Sustituir el campo **NIF/CIF** por **Código REEUP**, tanto en la etiqueta como en la columna que lo almacena.
- **BREAKING** Eliminar el campo **Cargo en la empresa**.
- **BREAKING** Eliminar la sección **Verificación de identidad** completa (tipo de documento, número de documento y país de residencia).
- **BREAKING** Eliminar el campo **Tipo de certificado** de la sección «Solicitud».
- Añadir en «Solicitud» dos botones de opción excluyentes: **Personal** (un único firmante) y **Varias Personas** (una relación de solicitantes).
- Al elegir «Varias Personas», mostrar las acciones **Adicionar** y **Carga masiva**. «Adicionar» abre un modal con la gestión de la relación de solicitantes: un formulario dinámico que pide **Nombre y Apellidos**, **Número de Carnet de Identidad**, **Dirección**, **Correo Electrónico** y **Número del Móvil**, con alta, edición y baja de filas.
- El modal ofrece **Exportar** (`.xlsx`) e **Importar** (`.xlsx` y `.csv`) la relación, para que quien tiene la lista en una hoja de cálculo no tenga que teclearla.
- El correo de aviso pasa a llevar la relación de solicitantes como adjunto, de modo que la información llegue sin depender de un segundo correo.
- **BREAKING** La ficha de una solicitud en el panel muestra la relación de solicitantes, y el filtro y las métricas por tipo de certificado se sustituyen por el modo de firmante. *(Este punto en el panel no se pidió de forma explícita; se incluye porque sin él las personas capturadas no serían consultables más que por correo. Se puede eliminar del alcance si se prefiere.)*

## Capabilities

### New Capabilities
- `applicant-roster`: Selección del modo de firmante, gestión de la relación de solicitantes en un modal con formulario dinámico, y su intercambio con hojas de cálculo mediante exportación `.xlsx` e importación de `.xlsx` y `.csv`.

### Modified Capabilities
- `signature-request-capture`: Cambian los campos del formulario público (nueva dirección y carnet en datos personales, nombre de empresa, Código REEUP en lugar de NIF/CIF, y eliminación de Cargo, verificación de identidad y tipo de certificado), y la solicitud pasa a incorporar el modo de firmante y su relación de solicitantes, adjunta al correo de aviso.
- `request-export`: Las columnas del CSV de exportación reflejan los campos nuevos y los retirados.
- `admin-dashboard`: El filtro y las métricas por tipo de certificado pasan a ser por modo de firmante, la búsqueda cubre el Código REEUP y el nombre de empresa, y la ficha de detalle muestra la relación de solicitantes.

## Impact

- **Esquema de datos**: migración que añade la tabla `RequestApplicant`, renombra `nif` a `reeupCode`, añade `personalAddress`, `personalIdNumber`, `businessName` y `signerMode`, y **elimina** las columnas `position`, `documentType`, `documentNumber`, `country` y `certificateType`. SQLite no admite `DROP COLUMN` sobre columnas `NOT NULL` sin más, así que la migración reconstruye la tabla; se pierde el histórico de identidad y de cargo de las solicitudes ya registradas.
- **Dependencias**: se añade `exceljs` para generar y leer hojas de cálculo. Es la única dependencia nueva y se usa **solo en servidor**: el importador no viaja al bundle del cliente. Se descarta `xlsx` (SheetJS) porque la versión publicada en npm está clavada en 0.18.5 y arrastra avisos de seguridad públicos; `exceljs@4.4.0` es la que sigue mantenida.
- **Endpoints**: dos Route Handlers nuevos, uno para descargar la plantilla/exportación de la relación y otro para parsear un fichero subido, además del envío de correo con adjunto.
- **Ficheros afectados**: `prisma/schema.prisma`, `lib/validation.ts`, `lib/email.ts`, `lib/csv.ts`, `data/requests.ts`, `app/actions/request-signature.ts`, `components/contact-form.tsx`, y los componentes del panel y sus rutas de exportación.
- **Sin cambios**: el flujo de estados y su historial, la autenticación del panel, la configuración de la base de datos y el pipeline de build.