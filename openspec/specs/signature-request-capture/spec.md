# signature-request-capture Specification

## Purpose
Captura y persistencia de las solicitudes enviadas desde el formulario público, con notificación best-effort, registro de fallos de correo y ausencia de pérdida de datos.

## Requirements

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

#### Scenario: Captura aditiva respecto al comportamiento anterior

- **WHEN** el sistema está desplegado con la base de datos configurada
- **THEN** el envío del formulario público sigue funcionando sin cambios en su interfaz
- **AND** el correo de aviso conserva su formato y destinatario actuales

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

### Requirement: Integridad de los datos capturados

El sistema SHALL conservar íntegramente los datos de la solicitud, incluidos los campos opcionales, y SHALL registrar el consentimiento de privacidad aceptado. Los valores de los campos enumerados SHALL estar validados en el momento de la captura.

#### Scenario: Todos los campos se conservan

- **WHEN** se persiste una solicitud con los campos opcionales `address` y `message` rellenos
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

- **WHEN** un envío contiene un tipo de documento o un tipo de certificado que no pertenece a la lista admitida
- **THEN** la validación falla
- **AND** no se persiste ningún registro con ese valor

#### Scenario: El tipo de certificado se reutiliza en el panel

- **WHEN** el panel de administración ofrece el filtro de tipo de certificado
- **THEN** las opciones ofrecidas son exactamente las mismas que admite la captura

### Requirement: Esquema de datos de las solicitudes

El sistema SHALL almacenar el historial de estados de cada solicitud en un registro independiente y asociado a la solicitud que lo originó, de modo que eliminar una solicitud elimine también su historial.

#### Scenario: El historial está vinculado a su solicitud

- **WHEN** una solicitud acumula transiciones de estado
- **THEN** cada transición queda asociada a esa solicitud
- **AND** al consultar una solicitud se obtienen solo sus propias transiciones

#### Scenario: El histórico se consulta en orden cronológico

- **WHEN** el panel muestra el historial de una solicitud con varias transiciones
- **THEN** las transiciones se muestran de la más antigua a la más reciente
