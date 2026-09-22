# api/ — gotchas locales

Lee primero el `CLAUDE.md` raíz. Aquí solo lo específico de la API.

- **Nest 11 + TypeORM 1.x + Zod 4.** En TypeORM 1.x las entidades se cargan por glob `**/*.orm-entity.{ts,js}`: nombra así las entidades de infraestructura para separarlas de las de dominio.
- **`.env` lo carga `loadDotEnv()`** (`process.loadEnvFile`, nativo desde Node 20.12; el proyecto exige Node ≥ 22.13, la versión del servidor) en `main.ts` y en `data-source.ts`. Nunca sobrescribe variables ya definidas, así que en producción mandan las de PM2 o el entorno.
- **Variables nuevas se añaden a `src/shared/infrastructure/config/env.ts`** (el esquema Zod) y a `.env.example`. La app no arranca si falta alguna.
- **CLI de TypeORM:** su entrada es `data-source.cli.ts`, la única que lee el env al importarse. La app solo importa `dataSourceOptions` desde `data-source.ts`.
- **Migraciones:** en local, `pnpm migration:*` usa ts-node sobre `src/`. En el servidor no hay ts-node: se usa `pnpm migration:run:prod`, que corre sobre `dist/`.
- **Errores:** lanza `DomainError(code, message, kind)` desde dominio o aplicación. El filtro global lo traduce a HTTP y a `{ error: { code, message } }`, así que no se lanzan `HttpException` desde casos de uso.
- **Endpoints con `@Res()` (SSE)** se saltan el interceptor `{ data }`. Si falla un stream ya abierto, el error se emite como evento; el filtro no puede reescribir la respuesta.
- **pnpm 11** exige decidir los build scripts en `pnpm-workspace.yaml` (`allowBuilds`). `@parcel/watcher` y `unrs-resolver` están en `false` y no hacen falta.
- **Postgres local:** rol y BD `constellation` (contraseña `constellation`, solo desarrollo). Ver `.env.example`.
