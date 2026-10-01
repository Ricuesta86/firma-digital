# request-workflow Specification

## Purpose
Gestión del ciclo de vida de la solicitud: máquina de estados cerrada con tabla de transiciones, registro histórico de transiciones y notas internas de gestión.

## Requirements

### Requirement: Máquina de estados de la solicitud

El sistema SHALL gestionar el ciclo de vida de la solicitud mediante un conjunto cerrado de estados y una tabla de transiciones permitidas. Una transición no permitida SHALL ser rechazada sin alterar el registro.

Estados admitidos: `NEW` (nueva), `IN_REVIEW` (en revisión), `ACCEPTED` (aceptada) y `REJECTED` (rechazada).

Transiciones permitidas:

- `NEW` → `IN_REVIEW`, `NEW` → `REJECTED`
- `IN_REVIEW` → `ACCEPTED`, `IN_REVIEW` → `REJECTED`
- `ACCEPTED` → `IN_REVIEW`, `REJECTED` → `IN_REVIEW`

#### Scenario: Cambio de estado válido

- **WHEN** el administrador cambia el estado de una solicitud a otro estado alcanzable
- **THEN** el sistema guarda el nuevo estado
- **AND** la solicitud pasa a mostrarse con el estado nuevo en el listado y en la ficha

#### Scenario: Aceptación sin revisión previa

- **WHEN** el administrador intenta pasar una solicitud directamente de `NEW` a `ACCEPTED`
- **THEN** el sistema rechaza la transición por no estar permitida
- **AND** el estado de la solicitud no cambia
- **AND** el sistema informa de que la transición no está permitida

#### Scenario: Cambio al mismo estado

- **WHEN** el administrador intenta asignar a una solicitud el estado que ya tiene
- **THEN** el sistema rechaza la operación
- **AND** no se registra ninguna transición en el historial

#### Scenario: Reapertura de una solicitud cerrada

- **WHEN** el administrador reabre una solicitud aceptada o rechazada pasándola a `IN_REVIEW`
- **THEN** el sistema guarda el cambio y lo registra en el historial

#### Scenario: El cambio de estado exige sesión

- **WHEN** se intenta cambiar el estado de una solicitud sin sesión de administrador
- **THEN** el sistema rechaza la operación y no modifica el estado

#### Scenario: El estado se refleja sin recargar manualmente

- **WHEN** el administrador confirma un cambio de estado
- **THEN** el listado y las métricas se actualizan con el nuevo estado sin exigir una recarga manual de la página

#### Scenario: Identificador de solicitud inválido

- **WHEN** se intenta cambiar el estado usando un identificador que no corresponde a ninguna solicitud
- **THEN** el sistema rechaza la operación
- **AND** no crea ningún registro

### Requirement: Registro histórico de transiciones

El sistema SHALL registrar en un histórico de solo incorporación cada transición de estado, con el estado de origen, el de destino, la fecha y una nota opcional, y SHALL escribir ese registro en la misma operación que actualiza el estado.

#### Scenario: La transición queda registrada

- **WHEN** el administrador cambia el estado de una solicitud
- **THEN** el sistema añade una entrada al historial de esa solicitud
- **AND** la entrada incluye el estado de origen, el de destino y la fecha del cambio

#### Scenario: La actualización y el registro son atómicos

- **WHEN** el registro de la transición en el historial falla
- **THEN** el estado de la solicitud no queda modificado

#### Scenario: El historial es de solo incorporación

- **WHEN** el administrador consulta el historial de una solicitud
- **THEN** las entradas se muestran de la más antigua a la más reciente
- **AND** el sistema no ofrece ninguna forma de editar o eliminar una entrada del historial

#### Scenario: La ficha muestra el historial

- **WHEN** el administrador abre la ficha de una solicitud ya gestionada
- **THEN** ve la secuencia completa de cambios de estado que ha tenido

#### Scenario: El comentario se asocia a la transición

- **WHEN** el administrador comenta un cambio de estado
- **THEN** el comentario queda asociado a esa entrada del historial

### Requirement: Notas internas de gestión

El sistema SHALL permitir al administrador añadir notas internas a una solicitud, visibles exclusivamente en el panel de administración y nunca en la web pública ni en el correo de aviso.

#### Scenario: Añadir una nota

- **WHEN** el administrador escribe una nota y la confirma
- **THEN** el sistema la guarda asociada a la solicitud
- **AND** la nota aparece en la ficha de esa solicitud

#### Scenario: Nota vacía

- **WHEN** el administrador confirma el alta de nota sin haber escrito texto
- **THEN** el sistema rechaza la operación
- **AND** no se crea ninguna nota

#### Scenario: Nota demasiado larga

- **WHEN** el administrador confirma un texto de nota que supera la longitud máxima admitida
- **THEN** el sistema rechaza la operación
- **AND** informa del límite admitido
- **AND** no se crea ninguna nota

#### Scenario: Las notas no son públicas

- **WHEN** un visitante consulta la web pública
- **THEN** no puede leer las notas internas de ninguna solicitud

#### Scenario: Las notas no se envían por correo

- **WHEN** el sistema envía el correo de aviso de una solicitud
- **THEN** el correo no incluye las notas internas

#### Scenario: Nota añadida sin sesión

- **WHEN** se intenta añadir una nota sin sesión de administrador
- **THEN** el sistema rechaza la operación
- **AND** no se crea ninguna nota

#### Scenario: Conservación de las notas

- **WHEN** el estado de una solicitud cambia
- **THEN** sus notas internas se conservan
