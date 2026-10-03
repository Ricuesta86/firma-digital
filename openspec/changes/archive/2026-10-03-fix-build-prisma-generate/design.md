## Context

El generator del schema es `provider = "prisma-client"` (Prisma 7), que no escribe un paquete en `node_modules` sino **código TypeScript** en el `output` declarado: `../lib/generated/prisma`. `data/db.ts:6` lo importa con el alias `@/lib/generated/prisma/client`, y ese path solo existe si alguien ha ejecutado `prisma generate`.

Ese directorio está en `.gitignore` (línea `lib/generated/`), correctamente: es código generado. Pero no hay ninguna fase del pipeline que lo regenere. En local se sostiene por la costumbre de ejecutar `pnpm db:generate` a mano, y en Vercel no hay nadie que lo haga, de modo que el clon que se despliega nunca lo tiene y Turbopack aborta al resolver el import:

```
./data/db.ts:6:1
Error: Module not found: Can't resolve '@/lib/generated/prisma/client'
Import map: aliased to relative './lib/generated/prisma/client' inside of [project]/
```

Verificado en local, y no es una particularidad de Vercel:

| Escenario | Resultado |
| --- | --- |
| `lib/generated/` ausente + `pnpm build` | aborta con el mismo `Module not found` |
| `lib/generated/` ausente + `pnpm typecheck` | `TS2307` en `data/db.ts` y en `scripts/check-*.ts`, más errores en cascada en `data/requests.ts` |
| `lib/generated/` presente + `pnpm build` | compila, 7 rutas, sin avisos |

Hay un segundo fallo, independiente del anterior y del mismo origen (configuración del pipeline, no de la aplicación): `prisma.config.ts` resuelve la configuración de base de datos **al cargarse**, para todos los comandos del CLI. Como `lib/db-config.ts` lanza `DatabaseConfigError` cuando el entorno está a medias, `prisma generate` falla si existe `TURSO_DATABASE_URL` sin `TURSO_AUTH_TOKEN`, o si coexisten una URL `file:` y una `libsql://`. Comprobado:

```
$ TURSO_DATABASE_URL=libsql://x.turso.io pnpm db:generate
Failed to load config file "..." Error: DatabaseConfigError: CONFIGURACION_BD_SIN_TOKEN: ...
```

Eso importa en Vercel porque sus variables tienen ámbito por entorno (Preview / Production): es fácil que un Preview herede la URL sin heredar el token, y entonces el build falla con un error que habla de base de datos cuando el problema es de credenciales ausentes en el ámbito.

Conviene distinguir el tercer frente, que **no** arregla este cambio: `next build` también importa `data/db.ts` al recoger los datos de página, así que con un entorno incoherente el build aborta igualmente con `CONFIGURACION_BD_*` (verificado). Eso es la validación temprana de D3 del cambio anterior-haciendo-trabajo: la configuración que se despliega sería inválida, así que el fallo es correcto. Se documenta, no se suaviza.

Restricciones heredadas que condicionan la solución:

- `lib/generated/` no se versiona, y no debe empezar a versionarse: es código generado, y versionarlo obliga a revisar diffs de cientos de ficheros en cada cambio de schema.
- `pnpm` es el gestor de paquetes (`packageManager: pnpm@11.8.0`) y `pnpm-workspace.yaml` declara `allowBuilds` para `@prisma/engines`, `prisma`, `better-sqlite3` y `esbuild`.
- Prisma es `devDependency`, igual que el resto del toolchain (`typescript`, `eslint`, `tsx`). Los comandos de base de datos (`db:migrate`, `db:deploy:turso`) son scripts de desarrollo, no parte del runtime.
- El proyecto documenta en el README los pasos manuales de despliegue; ese texto es parte del contrato operativo.

## Goals / Non-Goals

**Goals:**

- Que `lib/generated/prisma` exista antes de que cualquier comando del proyecto lo necesite: `build`, `typecheck`, `lint`, `dev`, en local y en el hosting.
- Que la generación no dependa de la configuración de base de datos, ni para completarse ni para fallar.
- Que la validación de configuración siga siendo estricta para los comandos que sí abren una conexión, con el mismo mensaje accionable.
- Corregir la documentación de despliegue para que describa el pipeline real y no un paso manual que desaparece.

**Non-Goals:**

- Versionar el cliente generado, o cambiar el `output` del generator.
- Cambiar `data/db.ts`, la resolución en `lib/db-config.ts` o el orden de precedencia de variables.
- Hacer que el build no valide la configuración de la aplicación. Se mantiene el fallo temprano en entorno incoherente (ver D5).
- Aplicar migraciones dentro del build. El esquema de Turso se sigue aplicando con `pnpm db:deploy:turso`, y el orden respecto al build se documenta.
- Añadir un fichero `vercel.json`, o configuración de build específica de proveedor.
- Migrar el proyecto a edge runtime, ni tocar `serverExternalPackages`.

## Decisions

### D1: `postinstall: prisma generate` como mecanismo principal

Se declara `"postinstall": "prisma generate"` en `package.json`. Es la recomendación oficial de Prisma para Vercel precisamente porque Vercel cachea `node_modules` y por eso el `postinstall` de `@prisma/client` no se vuelve a ejecutar en despliegues siguientes; un hook del proyecto raíz sí lo hace, porque pertenece a la fase de install, que Vercel ejecuta en cada despliegue.

Comprobado en este repositorio que `pnpm install` ejecuta el `postinstall` del paquete raíz (script de prueba en un directorio temporal con pnpm 11.8.0). El `allowBuilds` de `pnpm-workspace.yaml` solo gobierna los scripts de **dependencias**, no los del proyecto raíz, así que no hay que tocarlo.

**Matiz verificado durante la implementación, y es lo que convierte D2 en obligatoria:** `pnpm` no ejecuta ningún script de ciclo de vida cuando la instalación no tiene nada que hacer. Con `node_modules` ya al día, `pnpm install` (incluso con `--force`) responde `Already up to date` y no lanza el `postinstall`: medido en este repositorio tras borrar `lib/generated/`, el directorio no se regeneró. Es decir, D1 garantiza el cliente en una instalación real (clon nuevo, caché de Vercel invalidada, imagen de CI), pero **no** garantiza que el cliente exista si alguien borra el directorio generado y vuelve a instalar. D2 es lo que cierra ese hueco, y no esbeltaje opcional.

Alternativas descartadas:

- **Versionar `lib/generated/`**: convierte el cliente generado en fuente, con diffs enormes en cada cambio de schema y el riesgo de que un esquema y su cliente queden desincronizados en el commit. Además Vercel cachea installs, así que un cliente viejo en el repo es justo el fallo que se quiere evitar.
- **`vercel.json` con `buildCommand`**: arregla el build de Vercel y solo el de Vercel. Un clon nuevo en Docker o en otra CI seguiría sin cliente, y `pnpm typecheck` en un clon limpio fallaría igual. Se descarta porque el problema no es de Vercel, es que la generación no está en ninguna fase.
- **Mover el `output` del generator a `node_modules/@prisma/client`**: descartada de antemano; es la razón por la que Prisma 7 recomienda `prisma-client` sobre el generator clásico, y revertiriía una decisión ya tomada.

### D2: `prisma generate` también como primer paso de `build`

El script `build` pasa a ser `prisma generate && next build`, en vez de fiarse solo del hook de instalación.

Es redundante con D1 a propósito, y cubre un frente distinto: `postinstall` depende de que el instalador ejecute los hooks, y hay entornos legítimos donde no lo hace (`pnpm install --ignore-scripts`, una instalación que pnpm resuelve como `Already up date`, imágenes de build, `installCommand` propio en el proveedor). Con `build` autosuficiente, la construcción no depende de que se hayan ejecutado los hooks, y `pnpm build` es siempre una entrada válida por sí sola.

El coste es ~100 ms por build (medido: 102-119 ms) y una regeneración idempotente. Se considera asumible frente a la alternativa de un build que falla a mitad de compilación.

Un detalle de Vercel que conviene no dar por supuesto: con `build` presente en `package.json`, el comando de build del proyecto es el que usa el proveedor. Aun así, D1 sigue siendo el mecanismo primario precisamente para no depender de esa suposición.

### D3: `prisma.config.ts` solo declara `datasource.url` cuando la configuración resuelve

`prisma generate` no abre ninguna conexión: solo escribe código. Que exija un token válido es un acoplamiento equivocado que en la práctica rompe previews de Vercel.

Se comprueba el comportamiento real del CLI de Prisma 7 omitiendo el bloque `datasource` de la config:

| Comando | Config sin `datasource` |
| --- | --- |
| `prisma generate` | funciona, sin variables de entorno |
| `prisma migrate status` | `Error: The datasource.url property is required in your Prisma config file when using prisma migrate status.` |

O sea: `datasource` es opcional en la config y su ausencia solo afecta a los comandos que conectan. La implementación es envolver la resolución actual en un `try/catch` y, cuando `resolveDatabaseConfig()` lanza `DatabaseConfigError`, exportar la config **sin** `datasource`:

```ts
let datasource: { url: string } | undefined;
try {
  const database = resolveDatabaseConfig({ ... });
  datasource = { url: database.driver === "turso" ? `${database.url}?authToken=...` : database.url };
} catch (error) {
  if (!(error instanceof DatabaseConfigError)) throw error;
  // `prisma generate` no conecta: se omite la URL para no bloquear el build.
}

export default defineConfig({ schema: "prisma/schema.prisma", ...(datasource ? { datasource } : {}) });
```

Se re-lanza cualquier error que no sea `DatabaseConfigError`, para no enmascarar un fallo de importación de la propia config.

Lo que se pierde, y es el trade-off explícito: `pnpm db:migrate` con el entorno a medias deja de dar el mensaje `CONFIGURACION_BD_SIN_TOKEN`, que nombra la variable concreta, y pasa a dar el mensaje genérico del CLI de Prisma. Se acepta porque (a) el caso afectado es desarrollo local, donde el mensaje de Prisma sigue señalando `prisma.config.ts`, y (b) la alternativa, discriminar el comando para no relajar `migrate`, es acoplar el CLI a `process.argv`, que es frágil. Si en la práctica el mensaje genérico resulta insuficiente, la mejora futura es un flag dedicado (`PRISMA_CLI_STRICT_URL=1`) en lugar de sniffing de argv.

Lo que no cambia: `prisma.config.ts` sigue compartiendo `resolveDatabaseConfig()` con el runtime, y el token sigue viajando solo en el proceso del CLI (D4 del diseño anterior).

### D4: `prisma` se queda en `devDependencies`

Vercel instala las `devDependencies` durante la fase de build, que es donde se ejecuta `postinstall`. La documentación de Prisma avisa de que si aparece `prisma: command not found` en el despliegue, es porque Prisma está en `devDependencies` y el instalador se ejecutó en modo producción; la respuesta sería mover el CLI a `dependencies`.

No se mueve ahora: el runtime de la aplicación no invoca el CLI (el único proceso que lo usa es el build y el script de esquema de Turso), y mover el CLI a dependencias de producción lo metería en la imagen de runtime sin necesidad. Se deja documentado en el README como el primer sospechoso si el build de Vercel falla por ausencia del binario.

### D5: La validación de la aplicación sigue fallando en el build si el entorno está incoherente

`next build` recoge datos de página e importa `data/db.ts`, que valida al importarse (D3 del diseño anterior). Con `TURSO_DATABASE_URL` sin token, el build aborta con `CONFIGURACION_BD_SIN_TOKEN`.

Se mantiene sin cambios. Relajar la validación en el runtime significaría desplegar una aplicación que falla en la primera query en vez de en el despliegue, que es justo lo que D3 del diseño anterior quiso evitar. La alternativa (inicializar el cliente de Prisma de forma perezosa, en la primera query) es un refactor del DAL que no aporta nada a este arreglo.

Lo que sí se hace es documentar que el error aparece en el build y que significa "el ámbito de variables de entorno de este despliegue está incompleto", con la corrección concreta: definir `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` en el mismo ámbito, o ninguna.

### D6: La documentación describe el pipeline, no un paso manual

La sección de despliegue del README dice hoy "ejecuta `pnpm db:generate` y `pnpm db:deploy:turso` antes de `pnpm build`". Con D1 y D2, el paso de generar desaparece de la secuencia y solo queda `db:deploy:turso`, que sí es un paso real previo al despliegue porque el motor de migraciones de Prisma no habla libSQL (D6 del diseño anterior).

Se actualizan la sección de despliegue y la tabla de scripts, y se añade una nota de troubleshooting con los tres errores que alguien se va a encontrar en Vercel y que no significan lo que parece:

1. `Module not found: Can't resolve '@/lib/generated/prisma/client'` → el build no generó el cliente (D1/D2).
2. `CONFIGURACION_BD_SIN_TOKEN` o `CONFIGURACION_BD_AMBIGUA` durante el build → ámbito de variables incompleto (D5).
3. `prisma: command not found` → el instalador corrió en modo producción (D4).

## Risks / Trade-offs

- **Doble generación del cliente** (install y build) → mitigado por ser idempotente y por medir ~100 ms. Se acepta el coste a cambio de que ninguna fase dependa de la otra.
- **`postinstall` que falla rompe `pnpm install`** → si `prisma generate` falla (por ejemplo, schema inválido tras un commit), no se puede instalar. Se considera el comportamiento correcto: es preferible fallar en la instalación, con el error de Prisma, que desplegar un cliente ausente o desactualizado.
- **Relajar `prisma.config.ts` degrada el mensaje de `db:migrate`** en entorno incoherente → mitigado porque el mensaje de Prisma sigue apuntando a `prisma.config.ts`, y las variables ya están documentadas en `.env.example`. Alternativa guardada en D3 (flag explícito) si resulta insuficiente.
- **Un esquema y su cliente pueden quedar desincronizados en una caché de Vercel** → mitigado porque `postinstall` se ejecuta en cada despliegue, antes de `next build`. El riesgo residual es una caché de `node_modules` con un `lib/generated` viejo si la instalación se cachea y el hook se omite; D2 lo cubre regenerando en el build.
- **El cliente generado se importa desde `lib/`, dentro del bundle de Next.js** (es TS, no un paquete de `node_modules`) → verificado que `pnpm build` compila sin avisos y que `@prisma/client` figura en `serverExternalPackages`, así que el runtime se resuelve desde `node_modules` en el servidor. No se toca nada aquí; si Vercel se quejara del runtime, sería un cambio posterior en `next.config.ts`.
- **El primer despliegue en Vercel puede fallar por causas secundarias aún no vistas** (caché fría, binarios nativos, `better-sqlite3`) → mitigado por la nota de troubleshooting (D6), que convierte el error en el siguiente paso a mirar en lugar de un misterio.

## Migration Plan

1. Añadir `postinstall` y prefijar `build` con `prisma generate` en `package.json`.
2. Hacer condicional el `datasource` de `prisma.config.ts` (D3).
3. Verificar en local: `rm -rf lib/generated && pnpm typecheck && pnpm build` (el build regenera el cliente).
4. Verificar la tolerancia de la generación: `TURSO_DATABASE_URL=libsql://x.turso.io pnpm db:generate` debe pasar; `pnpm prisma migrate status` debe fallar con el mensaje de Prisma.
5. Verificar que la validación de la aplicación sigue activa: `pnpm build` con `TURSO_DATABASE_URL` sin token debe fallar con `CONFIGURACION_BD_SIN_TOKEN` (D5).
6. `pnpm lint`.
7. Actualizar el README (D6) y desplegar en Vercel con `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` en el mismo ámbito.
8. `pnpm db:deploy:turso` una vez contra la base de datos de destino antes de dar el despliegue por bueno.

Rollback: revertir `package.json` y `prisma.config.ts`. No hay migraciones, ni cambios de schema, ni de datos, así que el rollback no toca la base de datos; lo único que deshace es la automatización, que es exactamente el estado previo.

## Open Questions

- ¿Se quiere un pipeline de CI (GitHub Actions) que ejecute `typecheck`, `lint` y `build` en cada push? Con D1 y D2 ya no haría falta generar el cliente a mano, pero no está decidido si existe esa cinta de CI.
- ¿Los deploys de Preview deben apuntar a una base de datos de Turso aparte, o se acepta que hereden la de producción? Si heredan, el build del Preview conecta contra la base real al arrancar; hoy las rutas son dinámicas y no hay query en build, así que no hay riesgo de escritura, pero conviene decidirlo antes de que exista el primer Preview.
- ¿Se quiere un `vercel.json` con `installCommand` explícito para blindar el caso de un instalador en modo producción (D4), o se prefiere confiar en `postinstall` y documentar la excepción?
