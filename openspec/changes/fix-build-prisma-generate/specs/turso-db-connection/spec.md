## MODIFIED Requirements

### Requirement: Validación temprana de la configuración

El sistema SHALL validar la coherencia de la configuración de base de datos antes de abrir la conexión, y SHALL fallar con un error que identifique la variable concreta ausente o inconsistente. La validación SHALL ser comprobable de forma aislada, sin requerir una conexión de red. La validación SHALL NOT aplicarse a los comandos que no abren conexión, que son incapaces de fallar por una configuración inválida y cuya ejecución condiciona el pipeline de construcción.

#### Scenario: URL de Turso sin token

- **WHEN** el entorno define una URL con esquema `libsql://` pero no define `TURSO_AUTH_TOKEN`
- **THEN** el sistema lanza un error que nombra `TURSO_AUTH_TOKEN` como variable ausente
- **AND** lo hace antes de intentar conectar

#### Scenario: Token sin URL de Turso

- **WHEN** el entorno define `TURSO_AUTH_TOKEN` pero ninguna URL de conexión, o solo una URL local `file:`
- **THEN** el sistema no exige el token
- **AND** opera con la URL resuelta

#### Scenario: Fichero local y Turso configurados a la vez

- **WHEN** el entorno define simultáneamente una URL local `file:` y una URL de Turso `libsql://`
- **THEN** el sistema rechaza la configuración con un error que explica la ambigüedad
- **AND** no elige una de las dos en silencio

#### Scenario: El error identifica la variable

- **WHEN** la validación falla
- **THEN** el mensaje incluye el nombre de la variable de entorno implicada
- **AND** una indicación de cómo corregirla

#### Scenario: Comando que no abre conexión con la configuración incoherente

- **WHEN** el entorno tiene una configuración incoherente y se ejecuta un comando que no abre conexión
- **THEN** el comando se ejecuta correctamente
- **AND** no lanza un error de configuración de base de datos

#### Scenario: La aplicación sigue validando al arrancar

- **WHEN** la aplicación arranca con una configuración incoherente
- **THEN** falla antes de abrir la conexión, con el error que nombra la variable concreta
