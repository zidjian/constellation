# api/ — gotchas locales

Lee primero el `CLAUDE.md` raíz. Aquí solo lo específico de la API.

- **Nest 11 + TypeORM 1.x + Zod 4.** En TypeORM 1.x las entidades se cargan por glob `**/*.orm-entity.{ts,js}`: nombra así las entidades de infraestructura para separarlas de las de dominio.
- **`.env` lo carga `loadDotEnv()`** (`util.parseEnv`; no `process.loadEnvFile`, que bajo Jest no llega al `process.env` de los tests; el proyecto exige Node ≥ 22.13, la versión del servidor) en `main.ts`, en `data-source.cli.ts` y en los e2e. Nunca sobrescribe variables ya definidas, así que en producción mandan las de PM2 o el entorno.
- **Variables nuevas se añaden a `src/shared/infrastructure/config/env.ts`** (el esquema Zod) y a `.env.example`. La app no arranca si falta alguna.
- **CLI de TypeORM:** su entrada es `data-source.cli.ts`, la única que lee el env al importarse. La app solo importa `dataSourceOptions` desde `data-source.ts`.
- **Migraciones:** en local, `pnpm migration:*` usa ts-node sobre `src/`. En el servidor no hay ts-node: se usa `pnpm migration:run:prod`, que corre sobre `dist/`.
- **Errores:** lanza `DomainError(code, message, kind)` desde dominio o aplicación. El filtro global lo traduce a HTTP y a `{ error: { code, message } }`, así que no se lanzan `HttpException` desde casos de uso.
- **Endpoints con `@Res()` (SSE)** se saltan el interceptor `{ data }`. Si falla un stream ya abierto, el error se emite como evento; el filtro no puede reescribir la respuesta.
- **Generación en dos fases:** `GeneratePathUseCase.prepare()` valida todo lo que puede fallar "normalmente" (ownership, entrevista completada, límite de 10, nombre y `PATH_NOTHING_TO_LEARN`) **antes** de abrir el stream, así esos errores salen como JSON con su status. `run()` emite los eventos y persiste justo antes de `done`. Si el cliente corta (`res.on('close')` aborta la señal), no se guarda nada.
- **`PATH_STREAM_DELAY_MS`** (por defecto 150): pausa entre eventos para que la constelación se dibuje paso a paso. Con reglas todo es instantáneo y, sin la pausa, el cliente lo recibiría de golpe.
- **Rate limit de generación:** `UserThrottlerGuard` va **solo** en `POST /paths/generate`, cuenta por `userId` (corre después del guard global de sesión) y guarda el contador en memoria (una instancia). Cuenta todas las peticiones que pasan el guard, también las que fallan después. En los e2e, cada caso que genera varias veces necesita su propio usuario.
- **pnpm 11** exige decidir los build scripts en `pnpm-workspace.yaml` (`allowBuilds`). `@parcel/watcher` y `unrs-resolver` están en `false` y no hacen falta.
- **Seed del catálogo:** `pnpm seed` (ts-node) y `pnpm seed:prod` (`dist/`, en el servidor lo ejecuta `reload-constellation.sh`). `catalog.json` se copia a `dist/` como asset (`nest-cli.json`). Es idempotente: una segunda ejecución informa 0 cambios. Lo que ya no está en el JSON se borra, así que si una ruta lo referencia, la FK hace fallar el seed a propósito.
- **UUID:** `uuidExtension: 'pgcrypto'` hace que las migraciones usen `gen_random_uuid()`, nativo en Postgres ≥ 13, en vez de `uuid_generate_v4()`, que necesita `uuid-ossp`.
- **e2e con BD:** los e2e usan el Postgres de `DATABASE_URL` (en local el de `.env`; en CI, un servicio `postgres:18`). Corren **en serie** (`maxWorkers: 1` en `jest-e2e.json`) porque comparten BD. Cada suite limpia **solo sus propios** usuarios (`discord_id` con un prefijo propio, p. ej. `test-assess-%`): una limpieza con `LIKE 'test-%'` borra los de otra suite.
- **Entidades ORM:** el archivo debe terminar en `.orm-entity.ts` (singular), aunque tenga varias entidades. Si no, `migration:generate` dice "No changes".
- **Entrevista:** el banco de retos está en `assessment/domain/challenge-bank.ts`. La respuesta correcta solo vive ahí: el tipo `Question` que sale por la API no la tiene.
- **Postgres local:** rol y BD `constellation` (contraseña `constellation`, solo desarrollo). Ver `.env.example`.
