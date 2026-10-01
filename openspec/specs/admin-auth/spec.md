# admin-auth Specification

## Purpose
Autenticación y sesión del administrador mediante credenciales definidas en variables de entorno, cookie de sesión firmada con HMAC y protección de las rutas privadas del panel.

## Requirements

### Requirement: Autenticación por credenciales de entorno

El sistema SHALL autenticar al administrador mediante las credenciales definidas en las variables de entorno `ADMIN_EMAIL` y `ADMIN_PASSWORD`. La comparación de credenciales SHALL realizarse en tiempo constante y el fallo de autenticación SHALL presentar siempre el mismo mensaje, sin revelar si el correo o la contraseña son incorrectos.

#### Scenario: Credenciales válidas

- **WHEN** se envían el correo y la contraseña que coinciden con las variables de entorno configuradas
- **THEN** el sistema establece una sesión válida
- **AND** redirige al panel de administración

#### Scenario: Credenciales inválidas

- **WHEN** se envía una contraseña incorrecta con el correo configurado
- **THEN** el sistema rechaza el inicio de sesión
- **AND** no establece ninguna cookie de sesión
- **AND** muestra un mensaje de credenciales incorrectas

#### Scenario: Correo no reconocido

- **WHEN** se envía un correo que no coincide con `ADMIN_EMAIL`
- **THEN** el sistema rechaza el inicio de sesión
- **AND** el mensaje mostrado es indistinguible del producido por una contraseña incorrecta

#### Scenario: Comparación en tiempo constante

- **WHEN** el sistema compara las credenciales recibidas con las configuradas
- **THEN** la comparación no termina antes de haber evaluado la totalidad de ambos valores
- **AND** se comprueba la longitud de los valores antes de compararlos

#### Scenario: Credenciales no configuradas

- **WHEN** se intenta iniciar sesión y `ADMIN_EMAIL` o `ADMIN_PASSWORD` no están definidas
- **THEN** el sistema rechaza el inicio de sesión
- **AND** registra un error indicando que la configuración de administrador falta
- **AND** no funciona en modo degradado sin credenciales

### Requirement: Cookie de sesión firmada

El sistema SHALL emitir una cookie de sesión firmada con HMAC-SHA256 usando `ADMIN_SESSION_SECRET`, que contenga la identidad del administrador y su vigencia, y que no contenga ningún secreto. La verificación SHALL detectar cualquier alteración del contenido y SHALL rechazar las sesiones caducadas.

#### Scenario: La cookie se emite con atributos de protección

- **WHEN** el inicio de sesión tiene éxito
- **THEN** el sistema emite la cookie de sesión
- **AND** la cookie está marcada como no accesible por scripts
- **AND** la cookie restringe su envío al mismo sitio
- **AND** la cookie se marca como segura cuando la aplicación se ejecuta en producción
- **AND** la cookie está limitada a la aplicación completa

#### Scenario: Cookie con firma válida

- **WHEN** una petición llega con una cookie de sesión correctamente firmada y no caducada
- **THEN** el sistema la considera una sesión de administrador autenticada

#### Scenario: Cookie con firma alterada

- **WHEN** una petición llega con una cookie de sesión cuyo contenido o firma ha sido modificado
- **THEN** el sistema la rechaza como no autenticada
- **AND** la comparación de firmas se realiza en tiempo constante

#### Scenario: Cookie caducada

- **WHEN** una petición llega con una cookie de sesión correctamente firmada pero cuya vigencia ha expirado
- **THEN** el sistema la rechaza como no autenticada

#### Scenario: La cookie no contiene secretos

- **WHEN** el sistema emite la cookie de sesión
- **THEN** su contenido incluye la identidad del administrador y su vigencia
- **AND** no incluye la contraseña ni el secreto de firma

#### Scenario: Secreto de firma ausente

- **WHEN** se verifica una cookie de sesión y `ADMIN_SESSION_SECRET` no está definida
- **THEN** el sistema rechaza la sesión
- **AND** registra un error indicando que falta el secreto de sesión

### Requirement: Protección de las rutas administrativas

El sistema SHALL impedir el acceso al panel de administración a cualquier petición sin sesión de administrador válida. La comprobación de sesión SHALL realizarse dentro de cada acción de servidor y dentro de cada manejador de endpoint, con independencia de la navegación y de la comprobación previa de la página.

#### Scenario: Navegación sin sesión

- **WHEN** un visitante sin sesión solicita una página del panel de administración
- **THEN** es redirigido a la página de inicio de sesión
- **AND** no se le presenta ningún dato de solicitudes

#### Scenario: Acción de servidor sin sesión

- **WHEN** se invoca directamente, sin sesión válida, una acción de servidor que modifica el estado de una solicitud
- **THEN** la acción rechaza la operación
- **AND** no modifica ningún dato
- **AND** no revela información sobre la existencia de la solicitud

#### Scenario: Manejador de endpoint sin sesión

- **WHEN** se solicita el endpoint de exportación sin sesión de administrador válida
- **THEN** el endpoint responde con un error de no autorizado
- **AND** no devuelve el contenido de ninguna solicitud

#### Scenario: La acción revalida aunque la página ya estuviera autorizada

- **WHEN** una acción de servidor modifica una solicitud y la página que la contiene ya verificó la sesión
- **THEN** la acción vuelve a verificar la sesión por sí misma antes de operar

#### Scenario: Sesión válida y acceso concedido

- **WHEN** un administrador con sesión válida solicita una página del panel
- **THEN** se le presenta la página solicitada

### Requirement: Cierre y revocación de sesión

El sistema SHALL permitir al administrador cerrar su sesión eliminando la cookie, y SHALL invalidar todas las sesiones existentes cuando se rote el secreto de firma.

#### Scenario: Inicio de sesión estando ya autenticado

- **WHEN** un administrador con sesión válida solicita la página de inicio de sesión
- **THEN** es redirigido al panel de administración

#### Scenario: Cierre de sesión

- **WHEN** el administrador cierra sesión
- **THEN** el sistema elimina la cookie de sesión
- **AND** las peticiones posteriores al panel se tratan como no autenticadas

#### Scenario: Rotación del secreto

- **WHEN** se cambia el valor de `ADMIN_SESSION_SECRET` y se reinicia la aplicación
- **THEN** las cookies de sesión emitidas con el secreto anterior dejan de ser válidas
- **AND** el administrador debe volver a iniciar sesión

### Requirement: Aislamiento de los secretos y de los datos personales

El sistema SHALL confinar el acceso a la base de datos de solicitudes y a las variables secretas de administrador a una capa exclusiva de servidor, y SHALL impedir que ese código se ejecute en el cliente. Los componentes SHALL recibir únicamente los datos mínimos que necesitan para representarse.

#### Scenario: La capa de datos no se ejecuta en el cliente

- **WHEN** un módulo de acceso a datos de administración es importado desde un componente de cliente
- **THEN** la compilación falla

#### Scenario: Los secretos solo se leen en la capa de datos

- **WHEN** se revisa el código que accede a la base de datos o a las variables de administrador
- **THEN** reside únicamente en la capa de datos de servidor
- **AND** ninguna otra carpeta del proyecto importa el cliente de base de datos

#### Scenario: Las respuestas de acciones no filtran datos personales

- **WHEN** una acción de servidor completa una operación en el panel
- **THEN** su valor de retorno indica únicamente si la operación tuvo éxito y, en su caso, un mensaje de error
- **AND** no incluye el registro de la solicitud ni ningún dato personal

#### Scenario: Los datos no se derivan de la URL

- **WHEN** una página del panel decide qué contenido mostrar
- **THEN** toma esa decisión del resultado de la verificación de sesión en servidor
- **AND** no utiliza ningún parámetro de la URL como indicador de permiso
