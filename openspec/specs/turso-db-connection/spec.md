# turso-db-connection Specification

## Purpose
Configuración de la conexión entre Prisma y Turso (SQLite distribuido sobre libSQL/HTTP), incluyendo la precedencia de variables de entorno, el transporte y la manipulación del token, la validación temprana de la configuración, la instanciación única del cliente y la separación entre las migraciones de desarrollo y el despliegue del esquema.

## Requirements

### Requirement: Resolución de la URL de conexión

El sistema SHALL resolver la URL de la base de datos por este orden de precedencia: `DATABASE_URL`, `TURSO_DATABASE_URL`, y como último recurso el fichero local `file:./data/app.db`. La resolución SHALL ser opaca para el resto de la aplicación: la función que la expone SHALL conservar su nombre y su firma actuales, de modo que ninguna otra parte del código necesita modificarse para consumirla.

#### Scenario: Variable genérica con prioridad

- **WHEN** el entorno define a la vez `DATABASE_URL` y `TURSO_DATABASE_URL`
- **THEN** el sistema usa el valor de `DATABASE_URL` para conectar

#### Scenario: Turso como segunda opción

- **WHEN** el entorno define `TURSO_DATABASE_URL` y no define `DATABASE_URL`
- **THEN** el sistema usa el valor de `TURSO_DATABASE_URL` para conectar

#### Scenario: Fallback a fichero local

- **WHEN** el entorno no define `DATABASE_URL` ni `TURSO_DATABASE_URL`
- **THEN** el sistema usa `file:./data/app.db` como URL de conexión

#### Scenario: Desarrollo local sin credenciales

- **WHEN** la aplicación arranca sin ninguna variable de base de datos definida
- **THEN** opera contra el fichero SQLite local
- **AND** no exige ninguna configuración de Turso

### Requirement: Transporte de la conexión a Turso

El sistema SHALL conectar con Turso mediante el protocolo HTTP de libSQL usando una URL con esquema `libsql://`. La URL SHALL NOT contener el token de autenticación, y el token SHALL suministrarse como parámetro independiente del cliente.

#### Scenario: Conexión con token en parámetro separado

- **WHEN** el entorno define `TURSO_DATABASE_URL=libsql://<host>` y `TURSO_AUTH_TOKEN=<token>`
- **THEN** el sistema conecta al host indicado usando el token como credencial
- **AND** la URL de conexión no incluye el token

#### Scenario: El token no aparece en la URL

- **WHEN** el sistema inspecciona la URL de conexión resuelta
- **THEN** esa URL no contiene el valor del token ni ninguna credencial

### Requirement: Validación temprana de la configuración

El sistema SHALL validar la coherencia de la configuración de base de datos antes de abrir la conexión, y SHALL fallar con un error que identifique la variable concreta ausente o inconsistente. La validación SHALL ser comprobable de forma aislada, sin requerir una conexión de red.

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

### Requirement: Instancia única del cliente de base de datos

El sistema SHALL mantener una única instancia del cliente de base de datos por proceso, incluso cuando el hot reload de Next.js reevalúa los módulos en desarrollo, y SHALL NOT abrir un pool de conexiones adicional en cada recarga.

#### Scenario: Recarga de módulos en desarrollo

- **WHEN** el servidor de desarrollo recarga los módulos que importan el cliente de base de datos
- **THEN** las importaciones posteriores reciben la misma instancia de cliente
- **AND** no se crea una nueva

#### Scenario: Una sola instancia compartida

- **WHEN** varios módulos importan el cliente de base de datos
- **THEN** todos reciben la misma instancia compartida

### Requirement: Separación entre migraciones de desarrollo y de despliegue

El sistema SHALL separar el comando de desarrollo de migraciones del comando de despliegue. El comando de desarrollo SHALL operar contra la base de datos local y SHALL ser el único que genera SQL de migración nuevo. El despliegue del esquema en Turso SHALL realizarse con un comando propio, no con el motor de migraciones de Prisma, que no reconoce el esquema `libsql://`. El comando de despliegue SHALL ser idempotente: aplicarlo sobre un esquema ya aplicado no SHALL modificar la base de datos, y SHALL detectar si el schema cambió desde la última aplicación.

#### Scenario: Despliegue del esquema en Turso

- **WHEN** se ejecuta el comando de despliegue con `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` definidos
- **THEN** el esquema queda creado en la base de datos de Turso
- **AND** el comando es no interactivo

#### Scenario: El motor de migraciones de Prisma no se usa contra Turso

- **WHEN** se intenta aplicar el esquema en Turso con `prisma migrate deploy`, `prisma db push` o `prisma db execute`
- **THEN** esos comandos no son el mecanismo de despliegue en Turso, porque rechazan el esquema `libsql://`

#### Scenario: Despliegue repetido

- **WHEN** se ejecuta el comando de despliegue cuando el esquema ya está aplicado con el mismo schema
- **THEN** el comando informa de que no hay nada que hacer
- **AND** no modifica la base de datos

#### Scenario: El schema cambió desde la última aplicación

- **WHEN** se ejecuta el comando de despliegue y `prisma/schema.prisma` ha cambiado desde la última aplicación
- **THEN** el comando falla en lugar de dejar el esquema a medias
- **AND** explica que el cambio debe aplicarse revisando el SQL a mano

#### Scenario: Iteración local de migraciones

- **WHEN** un desarrollador crea una migración nueva
- **THEN** el comando de desarrollo de migraciones opera contra la base de datos local
- **AND** no aplica migraciones sobre la base compartida

#### Scenario: Despliegue sin destino Turso configurado

- **WHEN** se ejecuta el comando de despliegue sin `TURSO_DATABASE_URL`
- **THEN** el comando falla indicando que solo se aplica en Turso
- **AND** sugiere el comando de desarrollo para la base local
