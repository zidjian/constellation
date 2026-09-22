# Plan de implementación — DevTalles Constellation (MVP Code Quest 2026)

> **Documento de ejecución**, escrito el 2026-09-16. Traduce `00_especificaciones.md` (el *qué*) en fases, tareas, ramas y verificaciones (el *cómo* y el *cuándo*). Durante la fase **solo se marcan casillas** y se anotan desvíos en §9; si el diseño cambia, el cambio va a `CLAUDE.md` / ADR / `05_extensiones.md`, no aquí.
>
> Prioridad ante conflicto: **código → CLAUDE.md → ADR → specs (incluido este plan)**.

## Índice

1. Principios del plan
2. Calendario y camino crítico
3. Fase 0 — Fundaciones y walking skeleton desplegado
4. Fase 1 — Catálogo e identidad
5. Fase 2 — Dominio: `PathPlanner` y entrevista
6. Fase 3 — Generación de rutas, progreso e IA
7. Fase 4 — Web: entrevista, constelación y cielo de rutas
8. Fase 5 — Endurecimiento, producción y entrega
9. Registro de desvíos
10. Trazabilidad: criterios de aceptación → verificación
11. Riesgos y plan de recorte
12. Decisiones abiertas

---

## 1. Principios del plan

- **Desplegar el día 2, no el día 10.** Los riesgos reales no están en el dominio sino en la frontera: cookie entre subdominios, OAuth con redirect exacto, SSE detrás de Nginx, `NEXT_PUBLIC_*` en build. Un walking skeleton en producción los expone temprano.
- **Primero sin LLM.** Todo el flujo obligatorio se construye con los adaptadores `rules`; los adaptadores `claude` se enchufan después detrás de los mismos puertos (ADR-0001). Si el tiempo se acaba, la app ya cumple.
- **El dominio se escribe con tests antes que con controllers.** `PathPlanner`, la máquina de estados de `AssessmentSession` y la selección adaptativa son funciones puras con tests unitarios.
- **Vertical, no horizontal.** Cada fase termina con algo usable de punta a punta (API + web + smoke real), no con "toda la capa de datos lista".
- **Una rama por entrega**, PR a `develop`, `reviewer` antes de mergear. `develop → main` = release y deploy.
- **Cada tarea cierra con la Definition of Done de `CLAUDE.md`.** No se repite aquí; cada fase lista solo sus verificaciones específicas.

## 2. Calendario y camino crítico

Entrega: **lunes 2026-09-28 10:00 GMT-6**. Objetivo interno: **domingo 27 noche**. El lunes por la mañana es colchón, no tiempo planificado.

| Fecha | Día | Fase | Hito verificable al cierre del día |
|---|---|---|---|
| 16 mié | D0 | F0 | Repo, licencia, ramas, scaffolds `api`/`web` compilando |
| 17 jue | D1 | F0 | **Skeleton en producción:** HTTPS en ambos subdominios, `GET /v1/health`, SSE de prueba llegando incremental |
| 18 vie | D2 | F1 | Migración + seed del catálogo; `GET /v1/catalog/courses` |
| 19 sáb | D3 | F1 | **Login con Discord en producción**, cookie compartida, `/me`, `middleware.ts` |
| 20 dom | D4 | F2 | `PathPlanner` con tests verdes contra el catálogo real |
| 21 lun | D5 | F2 | Entrevista por API: iniciar → responder → completar → `SkillProfile` (rules) |
| 22 mar | D6 | F3 | `POST /paths/generate` en streaming + CRUD + progreso (rules) |
| 23 mié | D7 | F4 | Web: entrevista completa y generación visible en streaming |
| 24 jue | D8 | F4 | Web: constelación con progreso + cielo de rutas. **Feature-complete (rules)** |
| 25 vie | D9 | F3b | Adaptadores `claude` + fallback; texto libre / oferta de trabajo |
| 26 sáb | D10 | F5 | Criterios de aceptación 1–9 verificados en producción; pulido de motion |
| 27 dom | D11 | F5 | Release `main`, README final, video demo, envío |
| 28 lun | — | — | Colchón hasta las 10:00 |

**Camino crítico:** F0 deploy → identidad → catálogo → `PathPlanner` → assessment → generate → web constelación. El catálogo (`catalog-curator`) y el `PathPlanner` (con catálogo de fixture) pueden avanzar en paralelo desde D1.

```
D0-D1  F0 fundaciones ──► skeleton prod ─────────────────────────────┐
D1-D2        catalog-curator: catalog.json ──► seed ──┐               │
D2-D3        identity (OAuth, cookie, /me) ──────────┼──► web auth    │
D1-D4        PathPlanner (fixture → catálogo real) ──┤                │
D4-D5        assessment (dominio → API) ─────────────┤                │
D6           learning-path (generate SSE, CRUD) ─────┼──► web D7-D8   │
D9           adaptadores claude ─────────────────────┘                │
D10-D11      producción, criterios, pulido, video ◄──────────────────┘
```

---

## 3. Fase 0 — Fundaciones y walking skeleton desplegado (D0–D1)

**Agentes:** `devops` (repo, CI, instancia), `backend-implementer` y `frontend-implementer` (scaffolds). **Ramas:** `feature/bootstrap-api`, `feature/bootstrap-web`, `feature/infra-skeleton`.

### 3.1 Repositorio y proceso
- [x] `git init`, `.gitignore` (node, `.env*`, `dist`, `.next`), `LICENSE` MIT, commit inicial con docs existentes en `main`.
- [x] Crear repo en GitHub, rama `develop`, protección de `main` y `develop` (PR obligatorio, CI verde).
- [x] Plantilla de PR con checklist de la Definition of Done.
- [x] Registrar la app en Discord Developer Portal con las **dos** redirect URIs (local y producción, sin `/` final).

### 3.2 Scaffold `api/`
- [x] Nest + pnpm + TypeScript estricto, ESLint/Prettier, Jest.
- [x] `shared/infrastructure/config`: env validado con `zod` al arrancar (falla rápido): `PORT`, `DATABASE_URL`, `JWT_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_CALLBACK_URL`, `WEB_ORIGIN`, `COOKIE_DOMAIN` (vacío en local), `LLM_PROVIDER` (`claude`|`rules`), `ANTHROPIC_API_KEY` (opcional si `rules`), `ANTHROPIC_MODEL`, `LLM_TIMEOUT_MS=8000`. `.env.example` versionado.
- [x] `main.ts`: prefijo global `v1`, `trust proxy 1`, `cookie-parser`, `helmet`, CORS con `origin: WEB_ORIGIN` + `credentials: true`, `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`.
- [x] Formato único de API: interceptor `{ data }` y filtro de excepciones `{ error: { code, message } }`. Clase base `DomainError(code, message)` con mapeo a HTTP en `presentation`; errores no controlados → `500 INTERNAL_ERROR` sin stack.
- [x] TypeORM con `DataSource` compartido por app y CLI, `synchronize: false`, scripts `migration:generate|run|revert` (el script `seed` llega con el catálogo, §4.1).
- [x] `GET /v1/health` (público) y `GET /v1/health/stream` (SSE de prueba, 5 eventos a 1 s) — este último se elimina en F3.
- [x] Tests: e2e del formato de éxito/error.

### 3.3 Scaffold `web/`
- [x] Next.js App Router + TypeScript + Tailwind + ESLint, `output: 'standalone'`.
- [x] `src/lib/api.ts`: cliente `fetch` con `credentials: 'include'` y desempaquetado `{ data } / { error }` a un error tipado con `code`; variante server-side que reenvía la cookie `cst_session`.
- [x] Página `/` provisional que llama a `/v1/health` y consume `/v1/health/stream` con `fetch` + `ReadableStream`.

### 3.4 Infra y CI
- [x] Lightsail: DNS `A` de ambos subdominios, firewall solo 22/80/443, Nginx con un `server` por subdominio, certbot, PM2 con `ecosystem.config.js` y `pm2 startup`.
- [x] Nginx API: `proxy_buffering off`, `proxy_read_timeout 300s`, headers `X-Forwarded-*`.
- [x] PostgreSQL: usuario y BD `constellation` con permisos mínimos; cron de `pg_dump` diario.
- [x] GitHub Actions `ci.yml` (PR a `develop`/`main`): install, lint, test, build de ambos paquetes.
- [x] GitHub Actions `deploy.yml` (push a `main`): build en CI con `NEXT_PUBLIC_API_URL` de producción → `rsync` → `pnpm migration:run` → `pnpm seed` → `pm2 reload`.
- [x] Archivos de infraestructura versionados (ubicación a decidir por `devops`, p. ej. `deploy/`).

**Verificación de salida F0 (en producción):**
- `curl https://backend.constellation.waldirmaidana.com/v1/health` → `{ "data": ... }` con TLS válido.
- En el navegador, `/` muestra los 5 eventos de `/health/stream` **llegando uno a uno**, no de golpe.
- `nc -zv <ip> 5432` desde fuera → rechazado.
- Un PR con test roto queda bloqueado por CI.

---

## 4. Fase 1 — Catálogo e identidad (D1–D3)

### 4.1 Catálogo — `catalog-curator` + `backend-implementer` · `feature/catalog`

Fuente y proceso según **ADR-0004**: extracción offline del sitio público → snapshot → curación → seed.

- [x] Extractor `tools/catalog/extract-devtalles.mjs` y snapshot `tools/catalog/catalog.raw.json` (2026-09-16: 91 cursos, 13 rutas oficiales, 89 aristas, 6 aristas sin resolver, 0 fallos).
- [x] `catalog-curator`: `api/src/catalog/infrastructure/seed/catalog.json` a partir del snapshot (2026-09-21: 74 cursos, 63 skills, 61 aristas; queda la revisión humana de los datos sin confirmar):
  - filtrar: fuera legacy reemplazados, en construcción, `mas-DevTalles` y duplicados (decidir minicursos y gratuitos caso a caso);
  - prerrequisitos = aristas oficiales (`routes[].edges`) sin redundancias transitivas + resolución manual de `unresolvedEdges`;
  - nivel y skills `teaches`/`requires` desde `requirements`, `chapters`, `tier` y `tag`, con revisión humana curso a curso;
  - título limpio (sin el sufijo " - Fernando Herrera"), `durationHours` y `imageUrl` tal cual el snapshot.
  - Mínimo viable: todos los cursos de las rutas oficiales que no sean legacy.
- [x] Validador del catálogo (`tools/catalog/validate-catalog.mjs`, con funciones exportables para el seed) + tests (`validate-catalog.test.mjs`, `node --test`): slugs únicos, referencias existentes, sin autoprerrequisito, **grafo acíclico**, toda skill `requires` es enseñada por algún curso, todo curso enseña al menos una skill.
- [x] Migración `CreateCatalog`: `skills`, `courses`, `course_skills`, `course_prerequisites` con los constraints de §4 de la spec.
- [x] `pnpm seed`: upsert por `slug` en transacción, reconcilia relaciones (borra las que ya no están), falla con el ciclo concreto si el grafo no es DAG. Ejecutarlo dos veces no cambia nada.
- [x] Dominio: `Course`, `Skill`, `CatalogGraph` (lectura en memoria del catálogo completo para el planner) y `CatalogRepository` (puerto).
- [x] `GET /v1/catalog/courses` → cursos con skills y prerrequisitos (requiere sesión desde que exista el guard).

**Verificación:** seed ×2 idempotente (conteo de filas igual); test de ciclo con un catálogo de fixture; `curl` al endpoint.

### 4.2 Identidad — `backend-implementer` · `feature/identity-discord`

- [x] Migración `CreateUsers` (`discord_id` único, `username`, `avatar_url`).
- [x] ~~`passport-discord`~~ → OAuth2 a mano (ver §9) con `state` en cookie y scope `identify`; los tokens de Discord no salen de la estrategia.
- [x] Caso de uso `LoginWithDiscord`: upsert de usuario (solo `discordId`, `username`, `avatar`), emite JWT (7 días, `sub = userId`).
- [x] Callback: `Set-Cookie cst_session` (`HttpOnly`, `Secure` en prod, `SameSite=Lax`, `Domain` solo si `COOKIE_DOMAIN`), redirige a `WEB_ORIGIN/paths` si tiene rutas o `/assessment` si no. Error de OAuth → redirige a `/?error=auth`.
- [x] `JwtAuthGuard` **global** con decorador `@Public()` para las excepciones; `@CurrentUser()`; sin cookie o inválida → `401 UNAUTHENTICATED`.
- [x] `GET /v1/me` → `{ id, discordId, username, avatarUrl }`. `POST /v1/auth/logout` borra la cookie con el mismo `Domain`/`Path`.
- [x] Tests: e2e de `401` sin cookie, `/me` con JWT firmado en test, logout.

### 4.3 Auth en la web — `frontend-implementer` · `feature/web-auth`

- [x] `middleware.ts` → **`proxy.ts`** (Next 16): sin cookie `cst_session` en `/assessment` o `/paths/*` → redirige a `/`. (Solo presencia; la validez la decide la API.)
- [x] Layout del grupo protegido: Server Component que pide `/v1/me` reenviando la cookie; `401` → redirige a `/`.
- [x] Landing mínima con "Entrar con Discord" → `NEXT_PUBLIC_API_URL/v1/auth/discord`; avatar + logout en el header.

**Verificación de salida F1 (en producción):** criterios de aceptación **1 y 2**. Revisar en DevTools que la cookie tiene `Domain=.constellation.waldirmaidana.com` y que `/me` no contiene tokens.

---

## 5. Fase 2 — Dominio: `PathPlanner` y entrevista (D1–D5)

### 5.1 `PathPlanner` — `backend-implementer` · `feature/path-planner`

Servicio de dominio puro en `learning-path/domain/`, sin Nest ni TypeORM. Arranca en D1 con un catálogo de fixture y se valida contra el real al terminar F1.

Algoritmo (spec §3):
1. `targetSkills` → cursos que las enseñan (`teaches`). Si varios cursos enseñan la misma skill, se elige **uno** con desempate determinista: menos prerrequisitos no dominados → menor nivel → menor duración → slug (ver §12).
2. Cierre transitivo de prerrequisitos (`course_prerequisites`).
3. Quitar cursos cuyas skills `teaches` están todas en nivel ≥ umbral en el `SkillProfile`.
4. Orden topológico (Kahn) con desempate por nivel y luego duración, luego slug.
5. Si el resultado supera 15 pasos, se toma el **prefijo** del orden topológico (un prefijo es cerrado bajo prerrequisitos).
6. Resultado vacío → `DomainError PATH_NOTHING_TO_LEARN`.

- [x] Tests unitarios obligatorios: solo cursos del catálogo · prerrequisito siempre antes · cierre transitivo de varios niveles · quitar lo dominado sin romper el orden del resto · desempates estables (misma entrada ⇒ misma salida) · tope de 15 · vacío ⇒ error · skill objetivo sin curso ⇒ se ignora · test de propiedad sobre el catálogo real: para cada skill objetivo posible se cumple el criterio 5.

### 5.2 Assessment — `backend-implementer` · `feature/assessment`

- [x] Dominio `AssessmentSession`: `in_progress → completed | abandoned` irreversible; máx. 10 respuestas; `complete()` exige ≥ 5; responder o completar en estado final → `ASSESSMENT_ALREADY_COMPLETED` (409).
- [x] `question-bank.ts` curado: pregunta de objetivo (texto libre, admite oferta de trabajo pegada), elección de área, autoevaluación por área, y **mini-retos** por área y dificultad con respuesta verificable (opción múltiple: "¿qué imprime?", "¿qué falla?"). Cada reto referencia los slugs de skill que evalúa.
- [x] Selección adaptativa pura `nextQuestion(bank, answers)`: el área elegida fija la rama; acierto sube dificultad, fallo baja; termina al llegar a 10 o al agotar la rama. Tests unitarios.
- [x] Puntuación determinista de retos → `score` en `assessment_answers`.
- [x] `SkillInterpreterPort` + **adaptador `rules`**: niveles por skill a partir de autoevaluación + retos; `targetSkills` por área elegida y palabras clave del texto libre (diccionario skill ↔ términos). Salida validada contra slugs existentes.
- [x] Migraciones `CreateAssessment`: `assessment_sessions`, `assessment_answers`, `skill_profiles`.
- [x] Casos de uso con **ownership** (sesión de otro usuario → `404 ASSESSMENT_NOT_FOUND`): `StartAssessment` (abandona la `in_progress` previa), `AnswerQuestion` (valida que `question_key` es la pregunta esperada), `CompleteAssessment` (persiste `SkillProfile` con `interpreted_by`).
- [x] Endpoints `POST /assessments`, `POST /assessments/:id/answers`, `POST /assessments/:id/complete`. La pregunta enviada al cliente **no incluye** la respuesta correcta.

**Verificación de salida F2:** criterio **3** por `curl` con cookie real; tests de planner verdes contra el catálogo real.

---

## 6. Fase 3 — Generación de rutas, progreso e IA (D6 y D9)

### 6.1 Rutas y progreso (rules) — `backend-implementer` · `feature/learning-paths` (D6)

- [x] Dominio `LearningPath` (`active ⇄ archived`, 1–15 pasos) y `PathStep.complete()` / `uncomplete()`; progreso calculado (`completados / total`), nunca almacenado.
- [x] Migración `CreateLearningPaths`: `learning_paths`, `path_steps` con `UNIQUE(path_id, course_id)` y `UNIQUE(path_id, position)`.
- [x] `RationaleWriterPort` + **adaptador `rules`**: plantillas por motivo (enseña skill objetivo / es prerrequisito de X / cubre nivel detectado).
- [x] `GeneratePath` (caso de uso) como `AsyncIterable` de eventos, desacoplado de HTTP:
  1. valida ownership y que la sesión está `completed` con `SkillProfile`;
  2. valida límite de **10 rutas** → `PATH_LIMIT_REACHED` (409) antes de emitir nada;
  3. emite `profile` → `PathPlanner` → `step` × N → `rationale` × N;
  4. persiste ruta + pasos **en una transacción** y emite `done { pathId }`;
  5. cualquier fallo → evento `error { code, message }` y nada persistido.
- [x] Controller SSE sobre `POST /v1/paths/generate`: `@Res()` crudo, `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`, `flushHeaders()`, cancelación si el cliente cierra la conexión. Errores previos al stream (validación, 401, 429) responden con el formato JSON normal.
- [x] Rate limit **5 generaciones / usuario / hora** con `@nestjs/throttler` y tracker por `userId` (memoria es suficiente: una instancia) → `429 RATE_LIMITED`.
- [x] `GET /paths` (con progreso), `GET /paths/:id` (pasos + cursos + aristas de prerrequisito **dentro de la ruta**), `PATCH /paths/:id` (nombre / estado), `DELETE /paths/:id`, `PUT|DELETE /paths/:id/steps/:stepId/completion` (idempotentes). Ownership en cada caso de uso → `404 PATH_NOT_FOUND`.
- [x] Eliminar `/health/stream`.
- [x] Tests: unit de `LearningPath`/`PathStep`; e2e de generate (secuencia de eventos y persistencia), ownership cruzado, límite de 10, `429` en la 6ª.

**Verificación:** criterios **4, 5, 7, 8** por API contra el server vivo; criterio 4 repetido en producción tras el siguiente deploy.

### 6.2 Adaptadores `claude` — `backend-implementer` · `feature/llm-adapters` (D9)

- [x] Consultar la skill `claude-api` para modelo vigente, SDK y salida estructurada antes de escribir código.
- [x] `ClaudeSkillInterpreter`: prompt con la lista cerrada de slugs de skills; salida validada con `zod`; skills desconocidas descartadas; niveles fuera de rango recortados.
- [x] `ClaudeRationaleWriter`: recibe los pasos ya decididos y el perfil; devuelve texto por `courseId` validado; no puede añadir ni quitar pasos.
- [x] Decorador `WithFallback(primary, rules, timeoutMs)`: timeout de 8 s, error o validación fallida ⇒ adaptador `rules`, log con motivo, `interpreted_by` / `generated_by` reflejan quién respondió realmente.
- [x] Selección por `LLM_PROVIDER`; la API key nunca se loguea ni se devuelve.
- [x] Tests: fallback por timeout, por excepción y por salida inválida (cliente de Anthropic simulado).

**Verificación:** criterio **6** — con `LLM_PROVIDER=rules` y con una API key inválida, los criterios 3–5 siguen pasando.

---

## 7. Fase 4 — Web: entrevista, constelación y cielo de rutas (D7–D8)

**Agente:** `frontend-implementer`. Primer paso obligatorio: skill `impeccable` crea `PRODUCT.md` (tono, público, identidad "constelación"); `ui-ux-pro-max` genera el design system (tokens de color, tipografía, espaciado). Precedencia de diseño según `.claude/agents/README.md`.

### 7.1 Entrevista — `feature/web-assessment`
- [x] `/assessment`: inicia o retoma sesión; una pregunta a la vez; componentes por tipo (texto libre con área para pegar oferta, elección, autoevaluación, mini-reto con bloque de código resaltado).
- [x] Indicador de avance (n / máx.), botón "terminar" habilitado desde 5 respuestas, manejo de `409`.
- [x] Al completar: pedir nombre de la ruta → pantalla de generación.

### 7.2 Generación en streaming — `feature/web-generation`
- [x] Cliente SSE con `fetch` + `ReadableStream` + parser de líneas `event:` / `data:` (tolerante a chunks partidos); `AbortController` al desmontar.
- [x] Las estrellas aparecen conforme llegan `step`; la explicación se rellena con `rationale`; `done` navega a `/paths/[pathId]`; `error` muestra el mensaje por `code` (`PATH_NOTHING_TO_LEARN`, `PATH_LIMIT_REACHED`, `RATE_LIMITED`).

### 7.3 Constelación — `feature/web-constellation`
- [x] `/paths/[pathId]`: React Flow con layout determinista (dagre/elk) de izquierda a derecha según prerrequisitos; nodo "estrella" personalizado con estados completado / disponible / con prerrequisitos pendientes.
- [x] Panel de detalle del curso: resumen, duración, nivel, "por qué", enlace a DevTalles, marcar/desmarcar con actualización optimista y rollback ante error.
- [x] Advertencia (no bloqueo) al completar un curso con prerrequisitos pendientes dentro de la ruta.
- [x] Progreso de la ruta visible; renombrar, archivar, eliminar (con confirmación en UI propia, no `window.confirm`).

### 7.4 Cielo de rutas — `feature/web-paths`
- [x] `/paths`: rutas activas y archivadas con progreso, CTA a nueva evaluación, estado vacío que lleva a `/assessment`, límite de 10 comunicado antes de chocar con él.

**Verificación de salida F4 (local y luego producción):** flujo completo en el navegador: login → entrevista → generación visible incremental → constelación → marcar pasos → recargar → progreso persiste → segunda ruta en el cielo. Responsive en móvil (sin scroll horizontal), teclado navegable, `prefers-reduced-motion` respetado. `pnpm build && pnpm lint` sin errores nuevos.

---

## 8. Fase 5 — Endurecimiento, producción y entrega (D10–D11)

- [ ] Release `develop → main` y deploy por Actions; verificar criterios **1–9** en producción uno por uno y anotar resultado en §10.
- [ ] Segundo usuario de Discord real para el criterio 7 (ownership cruzado).
- [ ] `reviewer` sobre el conjunto: invariantes, gotchas, seguridad (guards, ownership, campos filtrados, rate limit), DoD.
- [ ] Motion: `find-animation-opportunities` → `animate` en los momentos clave (aparición de estrellas, completar paso); el usuario corre `/review-animations`.
- [ ] Estados de error y vacíos revisados (API caída, sesión expirada, ruta inexistente).
- [ ] Datos demo: cuenta preparada con 2–3 rutas en distintos niveles de progreso; guion de demo que funcione con `LLM_PROVIDER=rules`.
- [ ] `README.md` del proyecto (reemplaza el de la plantilla): qué es, capturas, arquitectura, cómo correrlo, enlaces de producción, licencia.
- [ ] `CLAUDE.md`: comandos reales, gotchas descubiertos, estructura final. `api/CLAUDE.md` y `web/CLAUDE.md` con gotchas locales.
- [ ] Video demo y envío a la hackathon con enlaces al repo y a producción.
- [ ] **Code freeze domingo 27 noche.** El lunes solo se tocan fallos que bloqueen la demo.

---

## 9. Registro de desvíos

_Anotar aquí fecha, qué cambió respecto al plan y por qué (una línea). Si el cambio afecta al diseño, además va a `CLAUDE.md` / ADR / `05_extensiones.md`._

| Fecha | Desvío | Motivo |
|---|---|---|
| 2026-09-16 | Se adelanta la extracción del catálogo a D0 y se decide la fuente (ADR-0004) | No hay API pública; el sitio publica rutas oficiales con prerrequisitos |
| 2026-09-21 | F0 (scaffolds) arranca en D5: el calendario va ~4 días atrasado | Tiempo dedicado al diseño y al catálogo; reajustar el calendario antes de F1 |
| 2026-09-21 | `middleware.ts` → **`proxy.ts`** en toda la web | Next 16 renombró la convención (ver `web/CLAUDE.md`) |
| 2026-09-21 | Producción en la instancia **compartida**: API :3011, web :3010; DNS de Cloudflare en gris; `pg_dump` diario a las 04:15 (`deploy/respaldo.sh`) y protección de ramas activas | 3001/3003 ocupados; el certificado de Cloudflare no cubre dos niveles y corta el SSE |
| 2026-09-21 | OAuth de Discord a mano (sin `passport-discord`); el `state` va en una cookie. El callback redirige siempre a `/paths` hasta que existan rutas (F3) | `passport` necesita `express-session` para el `state`, y la librería no se mantiene desde 2018 |
| 2026-09-22 | Entrevista: `GET /v1/assessments/current` (retomar) y `result: { correct }` al responder un reto, además de lo que pide la spec §6. La autoevaluación se deriva del catálogo en vez de un banco fijo por área | La web necesita retomar la entrevista, y la respuesta inmediata a los retos es parte de la experiencia. Derivarla del catálogo la mantiene coherente con él |
| 2026-09-22 | IA **híbrida** en el intérprete: Claude no reemplaza lo medido (retos y autoevaluación), solo aporta objetivos y niveles del texto libre. El porqué se pide al empezar el stream | Los retos son evidencia verificable; que el LLM los contradiga sería peor que las reglas. Pedir el porqué en paralelo da más margen al timeout de 8 s |
| 2026-09-22 | Regla de nivel: si falla un reto en dificultad d, nivel = máx(aprobado, mín(autoevaluación, d−1)) | La escalera puede empezar alta; antes quedaba en 0 sin haber probado el nivel 1 |
| 2026-09-22 | Constelación en **zigzag por orden de ruta** con líneas rectas (prerrequisito continuo, orden sugerido punteado) en vez de layout automático (dagre/elk) | Muchas rutas tienen cursos sin prerrequisitos entre sí: dagre los apilaba como una lista y en móvil los ponía en una sola fila ilegible |
| 2026-09-22 | El planner no expande los prerrequisitos de los cursos dominados | En un smoke apareció "Programación para principiantes" a alguien que aprobó los retos de JS |
| 2026-09-21 | Las variables de entorno se añaden al esquema cuando llega su feature, no todas en F0 | La app falla al arrancar si falta una variable; exigir las de Discord o del LLM antes de usarlas bloquea el desarrollo local |

## 10. Trazabilidad: criterios de aceptación → verificación

| # | Criterio (spec §8) | Test automático | Smoke manual | Fase | Prod ✔ |
|---|---|---|---|---|---|
| 1 | Sin sesión: `401 UNAUTHENTICATED` y `/paths` redirige | e2e guard | navegador incógnito | F1 | [ ] |
| 2 | Login deja `cst_session`; `/me` sin tokens | e2e `/me` | login real + DevTools | F1 | [ ] |
| 3 | Entrevista ≥5 ⇒ `SkillProfile`; responder `completed` ⇒ 409 | unit sesión + e2e | `curl` con cookie | F2 | [ ] |
| 4 | Generate emite `step` incremental y cierra con `done` | e2e secuencia | navegador en prod tras Nginx | F3 | [ ] |
| 5 | Solo cursos del catálogo y prerrequisito antes | unit + propiedad `PathPlanner` | consulta SQL sobre rutas generadas | F2/F3 | [ ] |
| 6 | Con `rules` o Anthropic caída, 3–5 se cumplen | unit fallback | prod con key inválida | F3b | [ ] |
| 7 | 2+ rutas, progreso persiste; otro usuario ⇒ 404 | e2e ownership | dos cuentas de Discord | F3/F4 | [ ] |
| 8 | 6ª generación en una hora ⇒ 429 | e2e throttler | `curl` en bucle | F3 | [ ] |
| 9 | HTTPS válido; 5432 cerrado | — | `curl -v`, `nc -zv` | F0 | [ ] |

## 11. Riesgos y plan de recorte

| Riesgo | Señal temprana | Mitigación |
|---|---|---|
| SSE llega de golpe detrás de Nginx | Falla la verificación de F0 | Resuelto en D1 con `/health/stream`; no se avanza a F3 sin esto |
| Cookie no llega a Next en prod | `/me` OK en API pero `middleware` redirige | `COOKIE_DOMAIN` verificado en D3 en producción, no en local |
| Catálogo incompleto o mal etiquetado | Rutas raras en el test de propiedad | Prerrequisitos basados en las rutas oficiales (ADR-0004); `catalog-curator` itera en D2–D4; validador en CI |
| OOM compilando en la instancia | — | Build siempre en CI (ADR-0003) |
| Rate limit de Discord OAuth o de Anthropic en la demo | Errores intermitentes | Demo con `rules`; sesión ya iniciada antes de grabar |
| Diseño de la constelación consume días | D8 sin constelación usable | Primero React Flow funcional con estilo básico; motion solo en D10 |

**Orden de recorte si hay retraso** (de lo primero que se sacrifica a lo último):
1. Animaciones más allá de aparición de estrellas y completar paso.
2. Advertencia de prerrequisitos pendientes al marcar.
3. Adaptador `ClaudeRationaleWriter` (queda el de plantillas).
4. Interpretación de oferta de trabajo pegada (queda el texto libre por palabras clave).
5. Adaptador `ClaudeSkillInterpreter` — **la app sigue cumpliendo todos los obligatorios con `rules`**.

**No se recorta nunca:** login Discord, entrevista, rutas dinámicas, varias rutas, progreso, MIT, despliegue, ramas/PRs, tests de `PathPlanner`.

## 12. Decisiones abiertas

Resolver antes de la fase indicada; la respuesta se registra en §9 (y en ADR si tiene alternativas reales).

| Decisión | Propuesta por defecto | Antes de |
|---|---|---|
| ~~Curso elegido cuando varios enseñan la misma skill objetivo~~ | **Resuelta:** el que añade menos cursos nuevos no dominados → nivel → duración → slug (`path-planner.ts`) | F2 (D4) |
| ~~Umbral de "skill dominada" y escala de niveles~~ | **Resuelta:** escala 0–3, dominada si ≥ 2 (`skill-profile.ts`) | F2 (D4) |
| ~~Fuente de datos del catálogo~~ | **Resuelta → ADR-0004:** snapshot del sitio público + rutas oficiales; un export oficial, si llega, manda | F1 (D1) |
| Modelo de Claude para interpretar y redactar | El que indique la skill `claude-api` para salida estructurada con buena latencia | F3b (D9) |
| Plan de Lightsail (memoria) | El existente; subir solo si PM2 + Postgres superan ~80 % de RAM | F0 (D1) |
