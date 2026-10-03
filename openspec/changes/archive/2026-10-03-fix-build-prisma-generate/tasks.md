## 1. Scripts de instalación y build

- [x] 1.1 Añadir `"postinstall": "prisma generate"` a `package.json`, junto al resto de scripts (D1). `prisma` se queda en `devDependencies` (D4)
- [x] 1.2 Cambiar `"build"` a `"prisma generate && next build"` para que la construcción no dependa de los hooks de instalación (D2)
- [x] 1.3 Confirmado que `pnpm-workspace.yaml` no necesita cambios: su `allowBuilds` solo gobierna scripts de dependencias, no los del proyecto raíz (D1). **Hallazgo:** `pnpm install` con `node_modules` al día responde `Already up to date` y no ejecuta ningún hook, así que `postinstall` no regenera el cliente en ese caso. Verificado en D1/D2 del diseño

## 2. Configuración del CLI de Prisma

- [x] 2.1 Envolver la resolución de `resolveDatabaseConfig()` en `prisma.config.ts` en un `try/catch` y exportar `datasource` solo cuando resuelva (D3)
- [x] 2.2 Re-lanzar cualquier error que no sea `DatabaseConfigError`, para no enmascarar un fallo al cargar la propia config (D3)
- [x] 2.3 Actualizar el comentario de cabecera de `prisma.config.ts`: la resolución ahora es condicional y `?authToken=` se sigue añadiendo solo para el CLI (D4 del diseño anterior, D3 de este)

## 3. Verificación funcional

- [x] 3.1 `pnpm db:generate && pnpm typecheck`: en verde, sin errores de módulo no encontrado. Corregido durante la implementación: `pnpm typecheck` no genera el cliente por sí mismo, y `pnpm install` con `node_modules` al día tampoco (hallazgo de 1.3), así que el paso explícito es lo que se puede comprobar en local
- [x] 3.2 `rm -rf lib/generated && pnpm build`: el propio build regenera el cliente y termina sin errores (D2)
- [x] 3.3 `TURSO_DATABASE_URL=libsql://x.turso.io pnpm db:generate`: debe pasar sin `CONFIGURACION_BD_SIN_TOKEN` (D3)
- [x] 3.4 `DATABASE_URL=file:./data/app.db TURSO_DATABASE_URL=libsql://x.turso.io TURSO_AUTH_TOKEN=t pnpm db:generate`: debe pasar sin `CONFIGURACION_BD_AMBIGUA` (D3)
- [x] 3.5 Con el entorno incoherente, `pnpm prisma migrate status` debe fallar con el mensaje de Prisma sobre `datasource.url`, confirmando que los comandos que conectan no se relajan (D3)
- [x] 3.6 `pnpm build` con `TURSO_DATABASE_URL` sin token debe seguir fallando con `CONFIGURACION_BD_SIN_TOKEN`: la validación de la aplicación no se toca (D5). Verificado: el build aborta con `DatabaseConfigError` (en local sale `CONFIGURACION_BD_AMBIGUA` porque `.env.local` aporta un `DATABASE_URL` local que Next fusiona con el del shell; el mecanismo y el punto de fallo son los mismos). Nota: `prisma generate` dentro del mismo comando sí pasó, que es justamente la tolerancia de D3
- [x] 3.7 `pnpm lint` y `pnpm typecheck` en verde

## 4. Documentación

- [x] 4.1 Actualizar la sección de despliegue del README: quitar el paso manual `pnpm db:generate` y dejar `pnpm db:deploy:turso` como paso previo real (D6)
- [x] 4.2 Documentar en el README que la generación es automática y que el cliente no se versiona (D1)
- [x] 4.3 Añadir al README una nota de troubleshooting con los tres errores típicos del despliegue: módulo no encontrado, `CONFIGURACION_BD_*` por ámbito de variables incompleto, y `prisma: command not found` por instalación en modo producción (D4/D5/D6)
- [x] 4.4 Revisar la tabla de scripts del README para que refleje el `build` y el `postinstall` nuevos

## 5. Comprobación final en el despliegue

- [ ] 5.1 Desplegar en Vercel con `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` definidas en el mismo ámbito, y confirmar que el build termina sin `Module not found`
- [ ] 5.2 Ejecutar `pnpm db:deploy:turso` contra la base de datos de destino antes de dar el despliegue por bueno (el build no aplica el esquema)
- [ ] 5.3 Confirmar en los logs del despliegue que la fase de install ejecutó `prisma generate` (si no aparece, revisar D4: instalador en modo producción)
