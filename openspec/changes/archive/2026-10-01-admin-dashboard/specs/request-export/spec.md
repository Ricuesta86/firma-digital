## ADDED Requirements

### Requirement: Descarga de exportaciones en CSV

El sistema SHALL ofrecer al administrador la descarga de las solicitudes registradas en formato CSV, y SHALL restringir la exportación a las solicitudes que cumplen los criterios de filtro indicados en la propia solicitud de descarga.

#### Scenario: Descarga sin filtros

- **WHEN** el administrador solicita la exportación sin indicar filtros
- **THEN** el sistema devuelve un CSV con todas las solicitudes registradas
- **AND** el fichero se descarga en lugar de mostrarse en el navegador

#### Scenario: La exportación respeta los filtros

- **WHEN** el administrador solicita la exportación indicando un estado, un tipo de certificado o una búsqueda
- **THEN** el CSV contiene únicamente las solicitudes que cumplen esos criterios
- **AND** no incluye solicitudes ajenas a los criterios

#### Scenario: Filtros combinados en la exportación

- **WHEN** el administrador solicita la exportación indicando varios criterios a la vez
- **THEN** el CSV contiene únicamente las solicitudes que cumplen todos ellos

#### Scenario: Exportación sin resultados

- **WHEN** la exportación solicitada no encuentra solicitudes
- **THEN** el sistema devuelve un CSV que contiene únicamente la fila de cabecera
- **AND** la descarga se completa sin error

#### Scenario: La exportación exige sesión

- **WHEN** se solicita la exportación sin una sesión de administrador válida
- **THEN** el sistema responde con un error de no autorizado
- **AND** no devuelve ningún dato de solicitudes

#### Scenario: Criterio inválido en la exportación

- **WHEN** la solicitud de exportación incluye un estado o un tipo de certificado inexistente
- **THEN** el sistema rechaza el valor inválido en lugar de aplicarlo
- **AND** responde sin error

### Requirement: Formato y seguridad del fichero CSV

El sistema SHALL generar un CSV correcto para su apertura en una hoja de cálculo, escapando los caracteres especiales de cada valor y evitando que un valor de dato se interprete como fórmula.

#### Scenario: Cabecera y columnas

- **WHEN** se genera un CSV
- **THEN** la primera fila es la cabecera con el nombre de cada columna
- **AND** cada fila posterior corresponde a una solicitud
- **AND** el número de valores de cada fila coincide con el de la cabecera

#### Scenario: Acentos legibles en hoja de cálculo

- **WHEN** se abre el CSV descargado en una hoja de cálculo
- **THEN** los caracteres acentuados y la letra ñ se muestran correctamente

#### Scenario: Valores con comas y comillas

- **WHEN** un valor de la solicitud contiene una coma, comillas dobles o un salto de línea
- **THEN** el CSV lo representa respetando el formato de campos entrecomillado
- **AND** al reimportar el fichero, ese valor se recupera íntegro

#### Scenario: Neutralización de fórmulas

- **WHEN** un valor de la solicitud empieza por `=`, `+`, `-` o `@`
- **THEN** el sistema lo neutraliza en el CSV para que una hoja de cálculo no lo ejecute como fórmula

#### Scenario: Neutralización de fórmulas en la cabecera de la petición

- **WHEN** un valor empieza por uno de los caracteres anteriores
- **THEN** el sistema lo prefija de forma que el valor original se conserve al reimportar

#### Scenario: Exclusión de información interna

- **WHEN** se genera el CSV
- **THEN** no incluye las notas internas de la solicitud
- **AND** no incluye el historial de cambios de estado
- **AND** no incluye el motivo de los fallos de notificación

#### Scenario: Estabilidad del orden

- **WHEN** se.exporta dos veces el mismo conjunto de solicitudes sin cambios entre ambas descargas
- **THEN** ambas exportaciones contienen las mismas solicitudes en el mismo orden

### Requirement: Descarga identificable

El sistema SHALL entregar el CSV como fichero adjunto, con un nombre que identifique su contenido y la fecha de generación, y con la codificación declarada de forma explícita.

#### Scenario: El fichero se descarga como adjunto

- **WHEN** el administrador completa la descarga
- **THEN** la respuesta indica que el contenido es una descarga adjunta y no una página web
- **AND** declara la codificación de caracteres del fichero
- **AND** el nombre del fichero incluye la fecha de generación
