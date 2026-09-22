# CLAUDE.md — DevTalles Constellation

> Este archivo es el **SSOT vivo** (single source of truth) del proyecto: la verdad operativa que todo agente lee **antes** de tocar nada. Manténlo al día con el código. Si una `spec` o un agente contradice este archivo o al código, **gana el código y luego CLAUDE.md**.

## Visión general

App para la hackathon **Code Quest 2026 (DevTalles)** — entrega: **2026-09-28 10:00 GMT-6** (objetivo interno: 2026-09-27 noche). Genera **rutas de aprendizaje dinámicas** sobre el catálogo real de cursos de DevTalles: el usuario entra con Discord, pasa una entrevista adaptativa (preguntas + mini-retos de código), y obtiene una **constelación** (grafo de cursos con prerrequisitos) que puede guardar (varias) y marcar como completada estrella a estrella.

**Fuera de esta fase:** pagos, panel de administración del catálogo (el catálogo es seed versionado), notificaciones/bot de Discord, app móvil, i18n (solo español).

## Stack y estructura

| Servicio | Tecnología | Puerto local | Producción |
|---|---|---|---|
| `api` | NestJS 11 + TypeORM 1.x + PostgreSQL, pnpm 11, Node ≥ 24.11 | 3001 | `https://backend.constellation.waldirmaidana.com` |
| `web` | Next.js 16 (App Router, output `standalone`), Tailwind 4, React Flow, Framer Motion, pnpm 11 | 3000 | `https://constellation.waldirmaidana.com` |
| db | PostgreSQL (en la misma instancia Lightsail, solo `localhost`) | 5432 | — |

Infra: **una instancia AWS Lightsail** → Nginx (TLS con certbot, reverse proxy por subdominio) → PM2 (`api`, `web`) → PostgreSQL local. Ver ADR-0003.

```
.
├── api/src/
│   ├── identity/        # login Discord, sesión (JWT en cookie), usuario
│   ├── catalog/         # cursos, skills, prerrequisitos (seed)
│   ├── assessment/      # entrevista adaptativa → SkillProfile
│   ├── learning-path/   # generación de rutas, pasos y progreso
│   └── shared/          # config, errores, formato de respuesta, puertos transversales
│       (cada contexto: domain/ · application/ · infrastructure/ · presentation/)
├── web/src/
│   ├── app/             # rutas: / · /assessment · /paths · /paths/[pathId]
│   └── features/        # assessment/ · constellation/ · paths/ · auth/
├── tools/catalog/       # extractor offline del sitio de DevTalles + snapshot catalog.raw.json (ADR-0004)
├── docs/adr/
└── specs/
```

## Invariantes (reglas que nunca se rompen)

- **Una ruta solo contiene cursos del catálogo.** El LLM nunca crea ni nombra cursos: su salida se valida contra IDs/slugs existentes y lo que no valida se descarta (ADR-0001).
- **El orden de una ruta respeta los prerrequisitos.** El grafo de prerrequisitos del catálogo es un DAG; el seed falla si detecta un ciclo.
- **Todo el flujo obligatorio funciona sin LLM.** Si la IA falla o hace timeout, se usa el adaptador por reglas; la demo nunca depende de una API externa.
- **Cada usuario solo ve y modifica sus propias rutas, sesiones y progreso.** El chequeo de ownership vive en los casos de uso, no solo en el controller.
- **Nunca se exponen ni persisten tokens de Discord ni la API key del LLM.** Del perfil de Discord guardamos solo `discordId`, `username` y `avatar`.
- **El progreso se deriva de los pasos** (`path_steps.completed_at`); no existe un porcentaje almacenado que pueda desincronizarse.
- **Una evaluación completada es inmutable** (`in_progress → completed | abandoned`, sin retorno).
- **Formato único de API:** éxito `{ "data": ... }`, error `{ "error": { "code", "message" } }`.
- **Esquema solo por migración** (`synchronize: false` siempre, también en local).

## Comandos

> `api/` y `web/` ya existen (Fase 0). `seed` todavía es un comando planeado: llega con el catálogo (F1).

```bash
cd api && pnpm start:dev          # API en :3001
cd api && pnpm build && pnpm test
cd api && pnpm migration:generate src/shared/infrastructure/database/migrations/<Nombre>
cd api && pnpm migration:run
cd api && pnpm seed                # catálogo (idempotente)
cd web && pnpm dev                 # web en :3000
cd api && pnpm test:e2e && pnpm lint
cd web && pnpm build && pnpm lint
node tools/catalog/extract-devtalles.mjs   # regenera tools/catalog/catalog.raw.json (existe; ~2 min, 1 req/s)
node tools/catalog/validate-catalog.mjs    # valida catalog.json: referencias, DAG, niveles (exit ≠ 0 si falla)
node --test tools/catalog/validate-catalog.test.mjs   # tests del validador
```

## Arquitectura (notas clave)

- **Auth:** el flujo OAuth2 de Discord lo resuelve la **API** (`passport-discord`, con `state` anti-CSRF). En el callback emite un JWT propio en cookie `httpOnly` y redirige a la web. Next lee la misma cookie en `proxy.ts` (Next 16 renombró `middleware.ts`) y en Server Components para proteger rutas (ADR-0002).
- **IA híbrida (ADR-0001):** `SkillInterpreterPort` (LLM → `SkillProfile` estructurado) + `PathPlanner` (servicio de dominio **determinista**: skills objetivo → cursos → cierre de prerrequisitos → quitar lo dominado → orden topológico) + `RationaleWriterPort` (LLM redacta el "por qué" de cada paso). Cada puerto tiene adaptador `claude` y adaptador `rules`.
- **Streaming:** la generación de una ruta se envía por SSE sobre `POST` (eventos `profile`, `step`, `rationale`, `done`); el cliente la consume con `fetch` + `ReadableStream`.
- **Progreso:** vive dentro del contexto `learning-path` (`PathStep.complete()` / `uncomplete()`); no hay contexto separado.
- **Git:** `main` = producción (deploy por GitHub Actions), `develop` = integración, `feature/*` / `fix/*` vía PR. Conventional Commits. Licencia MIT.

## Convenciones no obvias (gotchas)

- **Cookie de sesión con `Domain=.constellation.waldirmaidana.com`**, `Secure`, `SameSite=Lax`. Si es host-only del subdominio `backend.`, el `proxy.ts` y los Server Components de Next nunca la reciben. Ambos subdominios son *same-site*, por eso `Lax` es suficiente. En local no se pone `Domain`.
- **CORS con credenciales:** `origin` explícito (`WEB_ORIGIN`), nunca `*`, y `credentials: true`; en el cliente `credentials: 'include'`.
- **Nest detrás de Nginx:** `app.set('trust proxy', 1)`, o las cookies `Secure` y el rate-limit por IP se comportan mal.
- **SSE detrás de Nginx:** `proxy_buffering off`, header `X-Accel-Buffering: no` y `proxy_read_timeout` alto; si no, el streaming llega de golpe al final.
- **`EventSource` solo hace `GET` y no manda body:** para el stream de generación se usa `fetch` + `ReadableStream`.
- **`NEXT_PUBLIC_*` se incrustan en build time:** el build de producción debe hacerse con `NEXT_PUBLIC_API_URL=https://backend.constellation.waldirmaidana.com`.
- **Redirect URI de Discord debe coincidir exacto** (incluido `https` y sin `/` final) con la registrada en el Developer Portal; hay que registrar la local y la de producción.
- **El catálogo nunca se lee de devtalles.com en ejecución** (ADR-0004). `catalog.raw.json` es un snapshot factual que no se edita a mano; la curación vive en `catalog.json`. Regenerar el snapshot **no** regenera `catalog.json`: cambiar un slug rompe rutas guardadas.
- **Las `unresolvedEdges` de las rutas oficiales apuntan a cajas `multi-box`**: grupos de cursos alternativos (`<div class="multi-box" id>`) que el extractor todavía no parsea. No son ids rotos. Ya están resueltas a mano en `catalog.json`. Las páginas *legacy* no tienen bloque de requisitos ni de descripción (`requirements: []` es real, no un fallo del parser).
- **Las flechas oficiales no son todas prerrequisitos.** Muchas solo marcan el orden dentro de una ruta. Al unir rutas, el curso destino exigiría todas sus flechas, así que en `catalog.json` se quitaron las que contradicen los "Requisitos previos" del curso.
- **`prerequisites` es duro y `requires` es informativo** (incluye lo recomendado). El `PathPlanner` cierra solo sobre `prerequisites`, nunca sobre `requires`.
- **Los slugs de curso son los de la URL real** de DevTalles, con mayúsculas, `_` y `%XX` (p. ej. `NestJS-Testing`, `Ingenier%C3%ADa-de-prompts`). Se comparan exactos: no se pasan a minúsculas ni se decodifican. Los slugs de skill sí van en kebab-case y minúsculas.
- **Hay skills que enseñan varios cursos** (p. ej. `llm-apps` lo enseñan 7). El `PathPlanner` elige **un** curso por skill objetivo (plan §5.1 y §12); no los mete todos.
- **La instancia Lightsail es compartida** con otras apps (ver `deploy/README.md`). En producción la API escucha en **3011** y la web en **3010**, porque 3001 y 3003 ya están ocupados. Nunca se recarga ni se modifica nada ajeno a Constellation.
- **DNS en Cloudflare con la nube gris (DNS only).** Con proxy, el certificado gratuito de Cloudflare no cubre `backend.constellation.waldirmaidana.com` (dos niveles) y además corta el SSE a los 100 s. El TLS lo emite certbot en el servidor.
- **PostgreSQL solo escucha en `localhost`**; el puerto 5432 **no** se abre en el firewall de Lightsail. Acceso remoto por túnel SSH.

## Documentación del proyecto y flujo de agentes

- **`CLAUDE.md` (este archivo) = SSOT vivo.** Refleja el estado real.
- **`CLAUDE.md` por paquete** (`api/`, `web/`): gotchas locales de cada servicio.
- **`specs/00_especificaciones.md`**: diseño **congelado** de la fase inicial. No se edita una vez empezada la implementación.
- **`specs/02_plan_implementacion.md`**: plan de ejecución del MVP (fases, tareas, verificación); solo se marcan casillas y desvíos.
- **`specs/05_extensiones.md`**: **spec viva** — toda feature nueva añade su entrada aquí.
- **`docs/adr/`**: decisiones cross-capa con su *porqué* y alternativas descartadas.
- **`.claude/agents/`**: `architect`, `catalog-curator`, `backend-implementer`, `frontend-implementer`, `devops`, `reviewer` (flujo en su `README.md`).
- **`.claude/skills/`**: UI → `impeccable` (manda; necesita `PRODUCT.md` en su primer uso), motion → `emil-design-eng`, `animate`, `review-animations`, `improve-animations`, `find-animation-opportunities`, `animation-vocabulary`; datos de diseño → `ui-ux-pro-max`; utilidad → `caveman`. Plugins de proyecto en `.claude/settings.json`: `frontend-design`, `context7`, `typescript-lsp`. Precedencia y origen en `.claude/agents/README.md`.
- Regla de prioridad ante conflicto: **código → CLAUDE.md → ADR → specs/agentes**.
- Cuando una feature establezca una convención no obvia, **promuévela a «Gotchas» en el mismo cambio**.

## Definition of Done

Un cambio no está terminado hasta que pasa esto (lo que aplique a las capas tocadas):

- [ ] **Compila:** build de cada paquete modificado, sin errores.
- [ ] **Tests:** la suite pasa; añadidos/ajustados los del código nuevo; no rompe los existentes. `PathPlanner` siempre con tests unitarios.
- [ ] **Lint:** sin **nuevos** errores.
- [ ] **Esquema:** si cambió, hay migración versionada y reversible, aplicada y verificada en la BD. Nunca auto-sync de esquema.
- [ ] **Datos demo:** el seed sigue siendo idempotente; columnas nuevas con backfill explícito si hace falta.
- [ ] **Smoke real:** endpoint probado contra el server vivo (auth + petición real); UI verificada en el navegador. No "debería funcionar".
- [ ] **Seguridad:** rutas con guard explícito, ownership en casos de uso, rate-limit en generación de rutas; ninguna respuesta filtra campos internos.
- [ ] **Docs:** gotcha → «Gotchas»; decisión → ADR; feature → spec viva; CLAUDE.md refleja el estado real.
- [ ] **Reporte honesto:** si algo quedó sin verificar o un test falla, se dice con su salida.
