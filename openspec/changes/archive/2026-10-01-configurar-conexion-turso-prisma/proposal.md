## Why

Configurar la conexión entre Turso y Prisma permite usar una base de datos SQLite distribuida en la nube para la aplicación de firma digital, evitando depender únicamente de archivos locales y facilitando entornos de desarrollo, staging y producción con una URL centralizada.

## What Changes

- Configurar cliente Prisma para conectarse a Turso usando el driver de LibSQL/Prisma adaptado (libSQL) o el protocolo de Turso (con variables de entorno `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`).
- Añadir variables de entorno necesarias y documentación para conexión segura.
- Asegurar que el schema Prisma use proveedor SQLite compatible con Turso/LibSQL.
- Configurar cliente de base de datos para entornos serverless/Next.js (manejo de pool/conexión adecuado).
- Mantener compatibilidad con desarrollo local (SQLite file) como alternativa.

## Capabilities

### New Capabilities

- `turso-db-connection`: Configuración y validación de conexión entre Prisma y Turso, incluyendo variables de entorno, inicialización del cliente y manejo de errores.

### Modified Capabilities

- (Ninguna) No hay cambios a requisitos existentes de otras capacidades.

## Impact

- Configuración (`prisma/schema.prisma`, cliente Prisma, variables de entorno `.env.example`)
- Dependencias (paquete de conexión LibSQL/Turso para Prisma si es necesario)
- Inicialización de DB en código de servidor (evitar múltiples instancias en desarrollo)
- Documentación de despliegue/configuración
