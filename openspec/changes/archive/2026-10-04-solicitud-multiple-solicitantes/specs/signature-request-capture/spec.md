## ADDED Requirements

### Requirement: Conjunto de datos de la solicitud

La solicitud SHALL capturar una dirección y un número de carnet de identidad en los datos personales, un nombre de empresa y un código REEUP en los datos de la empresa, y SHALL NOT capturar cargo en la empresa, tipo de documento, número de documento ni país de residencia. El código REEUP SHALL ocupar el lugar del anterior identificador fiscal como dato de identificación de la empresa.

#### Scenario: Los datos personales incluyen dirección y carnet

- **WHEN** se observa el formulario público
- **THEN** los datos personales ofrecen un campo de dirección
- **AND** ofrecen un campo de número de carnet de identidad

#### Scenario: La dirección de la empresa sigue siendo independiente

- **WHEN** se observa el formulario público
- **THEN** los datos de la empresa ofrecen su propio campo de dirección
- **AND** es un campo distinto del de dirección de los datos personales

#### Scenario: Los datos de la empresa incluyen nombre de empresa y código REEUP

- **WHEN** se observa el formulario público
- **THEN** los datos de la empresa ofrecen un campo de nombre de empresa
- **AND** ofrecen un campo de código REEUP

#### Scenario: El identificador de la empresa es el código REEUP

- **WHEN** el visitante consulta los datos de la empresa
- **THEN** el campo de identificación de la empresa aparece etiquetado como código REEUP
- **AND** no aparece ningún campo etiquetado como NIF/CIF

#### Scenario: El nombre de la empresa convive con la razón social

- **WHEN** se observa el formulario público
- **THEN** los datos de la empresa ofrecen el nombre de la empresa
- **AND** ofrecen también la razón social, como campos distintos

#### Scenario: El cargo en la empresa ya no se solicita

- **WHEN** se observa el formulario público
- **THEN** no existe ningún campo de cargo en la empresa

#### Scenario: La sección de verificación de identidad ya no existe

- **WHEN** se observa el formulario público
- **THEN** no se solicitan tipo de documento, número de documento ni país de residencia

#### Scenario: El tipo de certificado ya no se solicita

- **WHEN** se observa el formulario público
- **THEN** no existe ningún campo de tipo de certificado

### Requirement: El modo de firmante gobierna la validación

El sistema SHALL validar el modo de firmante junto al resto de la solicitud, y SHALL aplicar una regla distinta según cuál sea: en modo «Personal» el número de carnet de identidad es obligatorio y no puede haber relación de solicitantes; en modo «Varias Personas» la relación de solicitantes es obligatoria y el número de carnet de identidad no se captura.

#### Scenario: Modo personal exige carnet

- **WHEN** se envía una solicitud en modo «Personal» sin número de carnet de identidad
- **THEN** la validación falla
- **AND** no se persiste ningún registro

#### Scenario: Modo personal sin relación

- **WHEN** se envía una solicitud en modo «Personal» con una relación de solicitantes
- **THEN** la validación falla
- **AND** no se persiste ningún registro

#### Scenario: Modo múltiple exige relación

- **WHEN** se envía una solicitud en modo «Varias Personas» sin ninguna persona en la relación
- **THEN** la validación falla
- **AND** no se persiste ningún registro
- **AND** no se envía ningún correo

#### Scenario: Modo de firmante inventado

- **WHEN** se envía una solicitud cuyo modo de firmante no es «Personal» ni «Varias Personas»
- **THEN** la validación falla
- **AND** no se persiste ningún registro con ese valor

#### Scenario: La regla se aplica aunque se manipule la petición

- **WHEN** se envía directamente una petición que declara el modo «Varias Personas» sin adjuntar la relación
- **THEN** la validación falla igualmente

### Requirement: Persistencia de la relación de solicitantes

El sistema SHALL asociar cada persona de la relación a la solicitud que la capturó, de modo que al eliminar una solicitud se elimine también su relación, y SHALL conservar el orden en que fueron añadidas.

#### Scenario: Cada persona queda asociada a su solicitud

- **WHEN** se persiste una solicitud en modo «Varias Personas»
- **THEN** sus personas quedan asociadas a esa solicitud
- **AND** al consultarla se obtienen solo las suyas

#### Scenario: La relación se elimina con su solicitud

- **WHEN** se elimina una solicitud que tiene personas asociadas
- **THEN** sus personas se eliminan también

#### Scenario: Modo personal sin relación

- **WHEN** se persiste una solicitud en modo «Personal»
- **THEN** no se almacena ninguna persona asociada a ella

### Requirement: El aviso lleva la relación de solicitantes adjunta

El sistema SHALL adjuntar al correo de aviso la relación de solicitantes de la solicitud en modo «Varias Personas», en un fichero de hoja de cálculo con una fila por persona. El fichero adjunto SHALL ser el mismo que el sistema ofrece para descargar desde el formulario. Las solicitudes en modo «Personal» SHALL notificarse sin adjuntos.

#### Scenario: La relación llega en el correo

- **WHEN** se persiste una solicitud en modo «Varias Personas» y el aviso se envía correctamente
- **THEN** el correo incluye un fichero adjunto con la relación de solicitantes
- **AND** el fichero contiene una fila por persona

#### Scenario: El adjunto coincide con el descargable

- **WHEN** se compara el fichero adjunto al correo con el que se descarga desde el formulario
- **THEN** ambos tienen el mismo contenido

#### Scenario: Aviso personal sin adjuntos

- **WHEN** se envía el aviso de una solicitud en modo «Personal»
- **THEN** el correo no incluye ficheros adjuntos

#### Scenario: El cuerpo del correo describe la solicitud

- **WHEN** se envía el aviso
- **THEN** el cuerpo del correo incluye los datos de la solicitud, incluido el modo de firmante
- **AND** no incluye los campos que el formulario ya no solicita

## MODIFIED Requirements

### Requirement: Persistencia de solicitudes válidas

El sistema SHALL almacenar toda solicitud que supere la validación del formulario público en la base de datos, antes de intentar cualquier notificación por correo. La persistencia SHALL ser la fuente de verdad de las solicitudes y SHALL ser independiente del canal de correo.

#### Scenario: Solicitud válida se persiste

- **WHEN** un visitante envía el formulario con todos los campos obligatorios correctamente rellenados
- **THEN** el sistema inserta un registro con todos los valores enviados
- **AND** la solicitud queda disponible para consulta en el panel de administración

#### Scenario: La nueva solicitud arranca en estado inicial

- **WHEN** se persiste una solicitud
- **THEN** su estado es `NEW`
- **AND** su fecha de creación es la del momento de la inserción

#### Scenario: Solicitud inválida no se persiste

- **WHEN** un visitante envía el formulario con un campo que no supera la validación
- **THEN** el sistema devuelve los errores por campo al formulario
- **AND** no se inserta ningún registro
- **AND** no se envía ningún correo

#### Scenario: Fallo de persistencia no notifica

- **WHEN** la escritura en la base de datos falla
- **THEN** el sistema devuelve un error al visitante
- **AND** no se envía ningún correo de aviso
- **AND** no se crea ningún registro parcial
- **AND** no queda ninguna persona de la relación persistida

#### Scenario: La solicitud se guarda aunque el aviso falle

- **WHEN** la solicitud se persiste correctamente y el envío del correo de aviso falla
- **THEN** la solicitud y su relación de solicitantes permanecen almacenadas

### Requirement: Notificación best-effort

El sistema SHALL enviar el correo de aviso después de persistir la solicitud, y SHALL tratar el fallo de envío como no bloqueante: una solicitud ya persistida SHALL conservarse aunque el envío por correo falle.

#### Scenario: Notificación satisfactoria

- **WHEN** una solicitud se persiste y el envío por SMTP funciona
- **THEN** el sistema registra la fecha y hora del envío
- **AND** no registra ningún error de notificación
- **AND** el visitante ve el mensaje de confirmación de éxito

#### Scenario: Fallo de SMTP no pierde la solicitud

- **WHEN** una solicitud se persiste correctamente y el envío por SMTP falla
- **THEN** la solicitud permanece en la base de datos
- **AND** el sistema registra el motivo del fallo de notificación
- **AND** el visitante ve igualmente el mensaje de confirmación de éxito
- **AND** el error se escribe en el registro de la aplicación

#### Scenario: El error de notificación es consultable

- **WHEN** una solicitud tiene un fallo de notificación registrado
- **THEN** el panel de administración muestra que su correo de aviso no se envió
- **AND** el panel muestra el motivo registrado

#### Scenario: Configuración SMTP ausente

- **WHEN** una solicitud se persiste y las variables SMTP no están configuradas
- **THEN** la solicitud se conserva en la base de datos con el fallo de notificación registrado
- **AND** el visitante ve el mensaje de confirmación de éxito

#### Scenario: Fallo al adjuntar la relación

- **WHEN** una solicitud con relación de solicitantes se persiste y el adjunto del correo no puede generarse o enviarse
- **THEN** la solicitud y su relación permanecen almacenadas
- **AND** el fallo queda registrado como fallo de notificación

### Requirement: Integridad de los datos capturados

El sistema SHALL conservar íntegramente los datos de la solicitud, incluidos los campos opcionales, y SHALL registrar el consentimiento de privacidad aceptado. Los valores de los campos enumerados SHALL estar validados en el momento de la captura.

#### Scenario: Todos los campos se conservan

- **WHEN** se persiste una solicitud con los campos opcionales `personalAddress` y `message` rellenos
- **THEN** el registro almacenado contiene esos valores
- **WHEN** se persiste una solicitud sin rellenar los campos opcionales
- **THEN** el registro almacena esos campos como ausentes, sin convertirlos en cadenas vacías

#### Scenario: El consentimiento de privacidad queda registrado

- **WHEN** se persiste una solicitud
- **THEN** el registro almacena que el consentimiento de privacidad fue aceptado

#### Scenario: Sin consentimiento no hay persistencia

- **WHEN** un visitante envía el formulario sin marcar el consentimiento de privacidad
- **THEN** la validación falla
- **AND** no se persiste ningún registro

#### Scenario: Los valores enumerados se rechazan

- **WHEN** un envío contiene un modo de firmante que no pertenece a la lista admitida
- **THEN** la validación falla
- **AND** no se persiste ningún registro con ese valor

#### Scenario: Los campos retirados no se persisten

- **WHEN** un envío incluye valores para cargo, tipo de documento, número de documento, país de residencia o tipo de certificado
- **THEN** el sistema los ignora
- **AND** no los almacena