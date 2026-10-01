## ADDED Requirements

### Requirement: Listado paginado de solicitudes

El sistema SHALL presentar al administrador un listado paginado de las solicitudes registradas, ordenadas de la más reciente a la más antigua, y SHALL indicar el total de solicitudes que cumplen los criterios activos.

#### Scenario: Página inicial

- **WHEN** un administrador abre el panel sin indicar filtros ni página
- **THEN** el sistema muestra la primera página de solicitudes
- **AND** las solicitudes aparecen ordenadas de más reciente a más antigua
- **AND** se indica el número total de solicitudes

#### Scenario: Recorrido de páginas

- **WHEN** el administrador navega a una página posterior
- **THEN** el sistema muestra el bloque de solicitudes correspondiente a esa página
- **AND** se indica la página actual y el número total de páginas
- **AND** los filtros activos se conservan al cambiar de página

#### Scenario: Número de página fuera de rango

- **WHEN** el administrador solicita una página que no existe
- **THEN** el sistema responde con la indicación de que no hay resultados
- **AND** no muestra datos de otra página

#### Scenario: Tamaño de página fijo

- **WHEN** existen más solicitudes que el tamaño de página configurado
- **THEN** el listado muestra el número máximo de solicitudes por página definido
- **AND** el resto queda disponible en páginas siguientes

#### Scenario: Sin solicitudes registradas

- **WHEN** no hay ninguna solicitud en la base de datos
- **THEN** el sistema muestra un estado vacío explicativo
- **AND** no muestra una tabla de resultados vacía sin explicación

### Requirement: Búsqueda y filtrado

El sistema SHALL permitir al administrador acotar el listado mediante una búsqueda de texto libre, un filtro por estado y un filtro por tipo de certificado. Los tres criterios SHALL ser combinables y SHALL quedar reflejados en la URL para poder compartirse y conservarse.

#### Scenario: Búsqueda por texto libre

- **WHEN** el administrador introduce un texto de búsqueda
- **THEN** el listado muestra únicamente las solicitudes cuyo nombre, correo, razón social o NIF contiene ese texto
- **AND** el resto de solicitudes no aparece

#### Scenario: Búsqueda sin coincidencias

- **WHEN** la búsqueda no encuentra ninguna coincidencia
- **THEN** el sistema informa de que no hay resultados para ese criterio
- **AND** no muestra solicitudes ajenas a la búsqueda

#### Scenario: Filtro por estado

- **WHEN** el administrador selecciona un estado
- **THEN** el listado muestra únicamente las solicitudes en ese estado

#### Scenario: Filtro por tipo de certificado

- **WHEN** el administrador selecciona un tipo de certificado
- **THEN** el listado muestra únicamente las solicitudes de ese tipo

#### Scenario: Filtros combinados

- **WHEN** el administrador combina búsqueda, estado y tipo de certificado
- **THEN** el listado muestra únicamente las solicitudes que cumplen los tres criterios a la vez

#### Scenario: Los filtros se reflejan en la URL

- **WHEN** el administrador aplica un filtro o una búsqueda
- **THEN** la dirección de la página incluye los criterios aplicados
- **AND** al abrir esa dirección se muestran los mismos resultados

#### Scenario: Criterio inválido

- **WHEN** la URL incluye un estado o un tipo de certificado que no existe en el dominio
- **THEN** el sistema rechaza el valor y no lo aplica como filtro
- **AND** no se produce un error que impida mostrar el panel

### Requirement: Ficha de detalle de la solicitud

El sistema SHALL mostrar al administrador una ficha con la totalidad de los datos de una solicitud concreta, su estado actual, sus notas internas, su historial de cambios y el resultado de la notificación por correo.

#### Scenario: Detalle completo

- **WHEN** el administrador abre la ficha de una solicitud existente
- **THEN** el sistema muestra todos los datos de contacto y de identidad de la solicitud
- **AND** muestra el tipo de certificado solicitado
- **AND** muestra la fecha de creación y el estado actual

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

El sistema SHALL mostrar en el panel un resumen del volumen de solicitudes, con el total desglosado por estado y el reparto por tipo de certificado.

#### Scenario: Totales por estado

- **WHEN** existen solicitudes en varios estados
- **THEN** el panel muestra el número de solicitudes en cada estado
- **AND** la suma de los estados coincide con el total de solicitudes

#### Scenario: Reparto por tipo de certificado

- **WHEN** existen solicitudes de varios tipos de certificado
- **THEN** el panel muestra el número de solicitudes de cada tipo

#### Scenario: Base de datos vacía

- **WHEN** no hay solicitudes registradas
- **THEN** todas las métricas muestran cero
- **AND** el panel no falla al calcularlas

#### Scenario: Las métricas reflejan el estado actual

- **WHEN** el administrador cambia el estado de una solicitud
- **THEN** las métricas de la siguiente carga ya reflejan el nuevo reparto por estado

### Requirement: Acceso exclusivo del administrador

El sistema SHALL presentar el contenido del panel únicamente a un administrador con sesión válida, y SHALL mantener la web pública sin ningún enlace ni referencia que permita el acceso directo.

#### Scenario: Visitante no autenticado

- **WHEN** un visitante no autenticado accede a la URL del panel
- **THEN** no obtiene ninguna información de las solicitudes

#### Scenario: Estructura visual del panel

- **WHEN** el administrador navega por el panel
- **THEN** dispone de un encabezado que identifica la sección, un acceso para cerrar sesión y una navegación de retorno a la web pública
- **AND** todas las páginas del panel comparten la misma estructura visual
