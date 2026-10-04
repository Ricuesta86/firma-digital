## ADDED Requirements

### Requirement: Selección del modo de firmante

El formulario SHALL ofrecer al visitante dos opciones excluyentes de modo de firmante, «Personal» y «Varias Personas», y SHALL exigir que una de ellas esté seleccionada antes de permitir el envío. Las acciones de gestión de solicitantes SHALL mostrarse únicamente cuando el modo seleccionado sea «Varias Personas» y SHALL permanecer ocultas en modo «Personal».

#### Scenario: Las dos opciones están disponibles

- **WHEN** el visitante abre la sección de solicitud
- **THEN** encuentra una opción «Personal» y una opción «Varias Personas»
- **AND** ninguna está seleccionada por defecto

#### Scenario: Las acciones de gestión dependen del modo

- **WHEN** el visitante selecciona «Varias Personas»
- **THEN** el sistema muestra las acciones «Adicionar» y «Carga masiva»
- **WHEN** el visitante selecciona «Personal»
- **THEN** el sistema oculta esas acciones

#### Scenario: Sin modo seleccionado no se envía

- **WHEN** el visitante envía el formulario sin haber seleccionado un modo de firmante
- **THEN** la validación falla
- **AND** no se persiste ninguna solicitud

### Requirement: Formulario dinámico de solicitante

El sistema SHALL solicitar, por cada persona de la relación, un nombre y apellidos, un número de carnet de identidad, una dirección, un correo electrónico y un número de móvil. El formulario dinámico SHALL admitir alta, edición y baja de personas, y SHALL conservar el orden en que fueron añadidas.

#### Scenario: Alta de una persona

- **WHEN** el visitante completa los cinco datos de una persona y la confirma
- **THEN** la persona aparece en la relación
- **AND** el formulario queda listo para la siguiente

#### Scenario: Datos incompletos

- **WHEN** el visitante confirma una persona con alguno de los cinco campos vacío o con un formato inválido
- **THEN** el sistema indica el error en el campo correspondiente
- **AND** la persona no se añade a la relación

#### Scenario: Edición de una persona ya añadida

- **WHEN** el visitante modifica los datos de una persona que ya está en la relación
- **THEN** la relación muestra los datos nuevos
- **AND** la persona no aparece duplicada

#### Scenario: Baja de una persona

- **WHEN** el visitante elimina una persona de la relación
- **THEN** la relación deja de mostrarla
- **AND** las demás personas no se ven afectadas

#### Scenario: La relación admite varias personas

- **WHEN** el visitante añade más de una persona
- **THEN** la relación las muestra todas
- **AND** mantiene el orden en que fueron añadidas

### Requirement: Límites y duplicados de la relación

El sistema SHALL limitar el número de personas de una relación y SHALL rechazar una relación que contenga dos personas con el mismo número de carnet de identidad, en lugar de descartar en silencio a una de ellas.

#### Scenario: Relación por encima del límite

- **WHEN** la relación supera el máximo de personas admitido
- **THEN** la validación falla indicando el límite
- **AND** no se persiste ninguna solicitud

#### Scenario: Carnets duplicados

- **WHEN** la relación contiene dos personas cuyo número de carnet de identidad coincide
- **THEN** la validación falla
- **AND** el error señala la fila que repite el carnet
- **AND** no se descarta ninguna de las dos personas

#### Scenario: Comparación de carnets sin distinguir formato

- **WHEN** dos carnets coinciden salvo en mayúsculas o espacios
- **THEN** el sistema los considera duplicados

### Requirement: Exportación de la relación a hoja de cálculo

El sistema SHALL permitir descargar la relación de solicitantes como fichero `.xlsx`, con una fila por persona y una columna por cada dato solicitado, cuyo nombre de fichero identifique su contenido y la fecha de generación.

#### Scenario: Descarga de la relación

- **WHEN** el visitante solicita exportar la relación desde el modal
- **THEN** el sistema entrega un fichero `.xlsx` descargable
- **AND** contiene una columna por cada uno de los cinco datos de solicitante

#### Scenario: Relación vacía

- **WHEN** el visitante solicita exportar una relación sin personas
- **THEN** el sistema entrega un fichero con la fila de cabecera y ninguna persona
- **AND** la descarga se completa sin error

#### Scenario: Valores que la hoja de cálculo interpretaría como fórmula

- **WHEN** un dato de un solicitante empieza por `=`, `+`, `-` o `@`
- **THEN** el sistema lo neutraliza en el fichero para que la hoja de cálculo no lo ejecute como fórmula

#### Scenario: Acentos legibles en la hoja de cálculo

- **WHEN** se abre el fichero descargado
- **THEN** los caracteres acentuados y la letra ñ se muestran correctamente

### Requirement: Importación de la relación desde una hoja de cálculo

El sistema SHALL permitir cargar la relación de solicitantes desde un fichero `.xlsx` o `.csv` cuya cabecera contenga los cinco datos de solicitante, y SHALL validar cada fila antes de incorporarla a la relación. La importación SHALL preservar los datos ya añadidos por el visitante.

#### Scenario: Importación de un fichero válido

- **WHEN** el visitante selecciona un fichero cuyas filas superan todas la validación
- **THEN** todas las personas del fichero se añaden a la relación

#### Scenario: Importación parcial

- **WHEN** alguna fila del fichero no supera la validación
- **THEN** el sistema informa de cuántas filas son válidas y de cuáles no
- **AND** señala el motivo por fila

#### Scenario: Fichero con formato desconocido

- **WHEN** el visitante selecciona un fichero que no es `.xlsx` ni `.csv`
- **THEN** el sistema rechaza la carga
- **AND** informa del formato admitido

#### Scenario: Cabecera incompleta

- **WHEN** el fichero no contiene alguna de las cinco columnas esperadas
- **THEN** el sistema rechaza la carga
- **AND** indica qué columnas faltan

#### Scenario: La importación conserva lo ya añadido

- **WHEN** la relación ya contiene personas y el visitante importa un fichero
- **THEN** las personas ya añadidas siguen en la relación

#### Scenario: Fichero demasiado grande

- **WHEN** el fichero supera el tamaño máximo admitido
- **THEN** el sistema lo rechaza antes de procesarlo
- **AND** informa del límite

### Requirement: Los datos del solicitante no viajan al cliente como hoja de cálculo

El procesamiento de los ficheros de la relación SHALL ejecutarse en el servidor. El navegador SHALL enviar el fichero y recibir filas ya validadas, sin procesar por sí mismo el contenido de una hoja de cálculo.

#### Scenario: El navegador no interpreta el fichero

- **WHEN** el visitante selecciona un fichero para importar
- **THEN** el contenido se procesa en el servidor
- **AND** el navegador no incluye la librería de hoja de cálculo en el código que se descarga al cargar el formulario

#### Scenario: Lo que recibe el formulario son filas validadas

- **WHEN** el servidor responde a una importación
- **THEN** devuelve las filas ya validadas o el error de validación por fila
- **AND** el navegador no decide qué datos son válidos

### Requirement: Recuperación de la relación tras un error de validación

Cuando el envío falle por validación, el sistema SHALL reponer en el modal la relación que el visitante había introducido, en lugar de presentarla vacía.

#### Scenario: La relación sobrevive a un error

- **WHEN** el visitante envía una solicitud con una relación y la validación del resto de campos falla
- **THEN** el modal se reabre con las personas que había añadido
- **AND** el error se muestra en el campo que lo causó

#### Scenario: El error se sitúa en su fila

- **WHEN** una persona de la relación tiene un dato inválido
- **THEN** el error se muestra junto a ese dato
- **AND** no se muestra como un error genérico del formulario