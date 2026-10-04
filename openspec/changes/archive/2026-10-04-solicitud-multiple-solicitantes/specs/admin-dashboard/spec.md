## MODIFIED Requirements

### Requirement: Búsqueda y filtrado

El sistema SHALL permitir al administrador acotar el listado mediante una búsqueda de texto libre y un filtro por estado. Los criterios SHALL ser combinables y SHALL quedar reflejados en la URL para poder compartirse y conservarse.

#### Scenario: Búsqueda por texto libre

- **WHEN** el administrador introduce un texto de búsqueda
- **THEN** el listado muestra únicamente las solicitudes cuyo nombre, correo, razón social, nombre de empresa, código REEUP o nombre de algún solicitante contiene ese texto
- **AND** el resto de solicitudes no aparece

#### Scenario: Búsqueda por el nombre de un solicitante

- **WHEN** el administrador busca el nombre de una persona que figura en la relación de una solicitud
- **THEN** el listado incluye esa solicitud

#### Scenario: Búsqueda por el código REEUP

- **WHEN** el administrador busca el código REEUP de una empresa
- **THEN** el listado incluye las solicitudes de esa empresa

#### Scenario: Búsqueda sin coincidencias

- **WHEN** la búsqueda no encuentra ninguna coincidencia
- **THEN** el sistema informa de que no hay resultados para ese criterio
- **AND** no muestra solicitudes ajenas a la búsqueda

#### Scenario: Filtro por estado

- **WHEN** el administrador selecciona un estado
- **THEN** el listado muestra únicamente las solicitudes en ese estado

#### Scenario: Filtro por modo de firmante

- **WHEN** el administrador selecciona un modo de firmante
- **THEN** el listado muestra únicamente las solicitudes de ese modo

#### Scenario: Filtros combinados

- **WHEN** el administrador combina búsqueda y estado, o los tres criterios
- **THEN** el listado muestra únicamente las solicitudes que cumplen todos a la vez

#### Scenario: Los filtros se reflejan en la URL

- **WHEN** el administrador aplica un filtro o una búsqueda
- **THEN** la dirección de la página incluye los criterios aplicados
- **AND** al abrir esa dirección se muestran los mismos resultados

#### Scenario: Criterio inválido

- **WHEN** la URL incluye un estado o un modo de firmante que no existe en el dominio
- **THEN** el sistema rechaza el valor y no lo aplica como filtro
- **AND** no se produce un error que impida mostrar el panel

### Requirement: Ficha de detalle de la solicitud

El sistema SHALL mostrar al administrador una ficha con la totalidad de los datos de una solicitud concreta, su modo de firmante, su relación de solicitantes, su estado actual, sus notas internas, su historial de cambios y el resultado de la notificación por correo.

#### Scenario: Detalle completo

- **WHEN** el administrador abre la ficha de una solicitud existente
- **THEN** el sistema muestra los datos de contacto y de empresa de la solicitud
- **AND** muestra el modo de firmante de la solicitud
- **AND** muestra la fecha de creación y el estado actual

#### Scenario: La ficha no muestra campos retirados

- **WHEN** el administrador abre la ficha de una solicitud
- **THEN** no aparecen el cargo, el tipo de documento, el número de documento, el país de residencia ni el tipo de certificado

#### Scenario: Ficha de una solicitud personal

- **WHEN** el administrador abre la ficha de una solicitud en modo «Personal»
- **THEN** el sistema muestra el número de carnet de identidad de la solicitud
- **AND** indica que no hay relación de solicitantes

#### Scenario: Ficha de una solicitud con varias personas

- **WHEN** el administrador abre la ficha de una solicitud en modo «Varias Personas»
- **THEN** el sistema muestra la relación de solicitantes con los cinco datos de cada persona
- **AND** indica cuántas personas contiene la relación

#### Scenario: Aviso de notificación fallida

- **WHEN** la solicitud tiene un fallo de notificación registrado
- **THEN** la ficha indica que el correo de aviso no se envió
- **AND** muestra el motivo registrado

#### Scenario: Aviso de notificación correcta

- **WHEN** la solicitud se notificó correctamente
- **THEN** la ficha indica que el correo de aviso se envió

#### Scenario: Solicitud inexistente

- **WHEN** el administrador solicita la ficha de un identificador que no existe
- **THEN** el sistema responde con una indicación de que no se encuentra
- **AND** no revela información de ninguna otra solicitud

#### Scenario: Acceso directo por URL

- **WHEN** el administrador accede por URL directa a una ficha sin haber pasado por el listado
- **THEN** el sistema aplica la misma verificación de sesión que en el resto del panel

### Requirement: Métricas agregadas

El sistema SHALL mostrar en el panel un resumen del volumen de solicitudes, con el total desglosado por estado y el reparto por modo de firmante.

#### Scenario: Totales por estado

- **WHEN** existen solicitudes en varios estados
- **THEN** el panel muestra el número de solicitudes en cada estado
- **AND** la suma de los estados coincide con el total de solicitudes

#### Scenario: Reparto por modo de firmante

- **WHEN** existen solicitudes de los dos modos de firmante
- **THEN** el panel muestra el número de solicitudes de cada modo

#### Scenario: Base de datos vacía

- **WHEN** no hay solicitudes registradas
- **THEN** todas las métricas muestran cero
- **AND** el panel no falla al calcularlas

#### Scenario: Las métricas reflejan el estado actual

- **WHEN** el administrador cambia el estado de una solicitud
- **THEN** las métricas de la siguiente carga ya reflejan el nuevo reparto por estado