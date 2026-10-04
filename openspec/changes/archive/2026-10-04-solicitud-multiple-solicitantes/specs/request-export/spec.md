## MODIFIED Requirements

### Requirement: Descarga de exportaciones en CSV

El sistema SHALL ofrecer al administrador la descarga de las solicitudes registradas en formato CSV, y SHALL restringir la exportación a las solicitudes que cumplen los criterios de filtro indicados en la propia solicitud de descarga.

#### Scenario: Descarga sin filtros

- **WHEN** el administrador solicita la exportación sin indicar filtros
- **THEN** el sistema devuelve un CSV con todas las solicitudes registradas
- **AND** el fichero se descarga en lugar de mostrarse en el navegador

#### Scenario: La exportación respeta los filtros

- **WHEN** el administrador solicita la exportación indicando un estado, un modo de firmante o una búsqueda
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

- **WHEN** la solicitud de exportación incluye un estado o un modo de firmante inexistente
- **THEN** el sistema rechaza el valor inválido en lugar de aplicarlo
- **AND** responde sin error

## ADDED Requirements

### Requirement: Columnas de la exportación de solicitudes

El CSV de exportación SHALL recoger el conjunto de datos vigente de la solicitud. No SHALL incluir columnas de campos que el formulario ya no solicita, y SHALL incluir el número de carnet de identidad cuando la solicitud se haya capturado en modo «Personal».

#### Scenario: Identificadores de la solicitud

- **WHEN** se genera el CSV
- **THEN** incluye el código REEUP como identificador de la empresa
- **AND** no incluye ninguna columna de NIF/CIF

#### Scenario: Datos de empresa vigentes

- **WHEN** se genera el CSV
- **THEN** incluye el nombre de la empresa
- **AND** no incluye el cargo en la empresa

#### Scenario: Datos personales vigentes

- **WHEN** se genera el CSV
- **THEN** incluye la dirección de los datos personales
- **AND** incluye el número de carnet de identidad de la solicitud en modo «Personal»

#### Scenario: El modo de firmante sustituye al tipo de certificado

- **WHEN** se genera el CSV
- **THEN** incluye el modo de firmante de la solicitud
- **AND** no incluye el tipo de certificado
- **AND** no incluye el tipo de documento, el número de documento ni el país de residencia

#### Scenario: La relación de solicitantes no se exporta

- **WHEN** se genera el CSV
- **THEN** una solicitud con muchas personas de la relación ocupa una única fila
- **AND** no incluye una fila por persona de la relación