## ADDED Requirements

### Requirement: Generación del cliente de Prisma en el pipeline de instalación y build

El pipeline de instalación y construcción del proyecto SHALL generar el cliente de Prisma de forma automática, sin ningún paso manual, antes de que cualquier comando del proyecto lo necesite. El cliente generado SHALL permanecer sin versionar, por ser código generado. Los comandos que consumen el cliente (build, comprobación de tipos, lint y desarrollo) SHALL funcionar sobre un clon recién obtenido, sin que quien despliega tenga que conocer la existencia del directorio generado.

#### Scenario: Despliegue en Vercel desde un clon limpio

- **WHEN** se despliega el proyecto en un proveedor de hosting que instala las dependencias y construye la aplicación, sin ejecutar ningún comando previo por parte de quien despliega
- **THEN** el cliente de Prisma existe antes de la fase de build
- **AND** la construcción finaliza sin errores de módulo no encontrado

#### Scenario: Clon recién obtenido

- **WHEN** una persona clona el repositorio e instala las dependencias
- **THEN** el cliente de Prisma queda generado como parte de la instalación
- **AND** la comprobación de tipos y el lint se ejecutan sin errores de módulo no encontrado

#### Scenario: Construcción sin hooks de instalación

- **WHEN** la construcción se lanza en un entorno donde el instalador no ejecuta los scripts del proyecto
- **THEN** la fase de build genera el cliente antes de compilar la aplicación

#### Scenario: El cliente generado no se versiona

- **WHEN** se inspecciona el directorio del cliente generado
- **THEN** está excluido del control de versiones
- **AND** el repositorio no contiene código generado por Prisma

### Requirement: La generación del cliente no depende de la configuración de base de datos

La generación del cliente de Prisma SHALL ser posible sin variables de entorno de base de datos, y SHALL NOT fallar cuando el entorno define una configuración incompleta o incoherente. La generación SHALL NOT abrir ninguna conexión. Los comandos que sí abren una conexión SHALL conservar la validación de configuración y SHALL fallar cuando esta no se pueda resolver.

#### Scenario: Generación sin variables de entorno

- **WHEN** se ejecuta la generación del cliente en un entorno sin ninguna variable de base de datos definida
- **THEN** la generación termina correctamente

#### Scenario: URL de Turso sin token en el entorno de build

- **WHEN** el entorno define una URL de Turso pero no define el token, y se ejecuta la generación del cliente
- **THEN** la generación termina correctamente
- **AND** no se informa de un error de configuración de base de datos

#### Scenario: URL local y URL de Turso a la vez en el entorno de build

- **WHEN** el entorno define simultáneamente una URL local y una URL de Turso, y se ejecuta la generación del cliente
- **THEN** la generación termina correctamente

#### Scenario: Comando que sí conecta con la configuración incoherente

- **WHEN** el entorno tiene una configuración incoherente y se ejecuta un comando que abre conexión
- **THEN** el comando falla
- **AND** el fallo indica que falta configuración de base de datos

### Requirement: Procedimiento de despliegue documentado

La documentación del despliegue SHALL describir la secuencia real de publicación, sin pasos manuales de generación del cliente, y SHALL recoger los errores de build típicos del entorno de despliegue con su causa y su corrección.

#### Scenario: La secuencia de despliegue no exige generar el cliente a mano

- **WHEN** alguien sigue la secuencia de despliegue documentada
- **THEN** no incluye la generación manual del cliente de Prisma
- **AND** incluye la aplicación del esquema en la base de datos de destino, que sigue siendo un paso previo

#### Scenario: Error de módulo no encontrado en el despliegue

- **WHEN** la documentación recoge el error de módulo no encontrado del cliente de Prisma
- **THEN** explica que la fase de build no generó el cliente
- **AND** indica cómo se corrige

#### Scenario: Error de configuración durante el build

- **WHEN** la documentación recoge un error de configuración de base de datos durante la fase de build
- **THEN** explica que el ámbito de variables de entorno del despliegue está incompleto
- **AND** indica que las variables de conexión deben definirse juntas en el mismo ámbito

#### Scenario: Binario de Prisma no disponible en el despliegue

- **WHEN** la documentación recoge el error de binario de Prisma no encontrado en el despliegue
- **THEN** explica que el instalador se ejecutó en modo producción
- **AND** indica cómo se corrige
