# Especificaciones Técnicas — DevTalles Constellation

> **Diseño congelado de la fase inicial (MVP Code Quest 2026).** Escrito el 2026-09-16, antes de implementar. Una vez arrancada la implementación no se edita: lo nuevo va a `05_extensiones.md` y la verdad operativa vive en `CLAUDE.md`.

## Índice

1. Contexto y alcance
2. Stack tecnológico
3. Arquitectura del sistema
4. Modelo de datos
5. Reglas de negocio / máquinas de estado
6. Endpoints / contratos
7. Decisiones de diseño
8. Criterios de aceptación

## 1. Contexto y alcance

Estudiantes (actuales o potenciales) de DevTalles no saben en qué orden tomar los cursos del catálogo según su nivel y su objetivo. Constellation los evalúa y les propone rutas personalizadas y visuales.

**Requerimientos obligatorios de la hackathon:** login con Discord · cuestionario de habilidades e intereses · rutas dinámicas · guardar múltiples rutas · marcar progreso · licencia MIT · despliegue funcional · código limpio · uso riguroso de ramas.

**Entra:** todo lo anterior + entrevista adaptativa con mini-retos, generación en streaming, constelación interactiva, explicación por curso, entrada libre de objetivo (incluido "pega una oferta de trabajo").

**Se posterga:** admin de catálogo, bot/notificaciones de Discord, compartir rutas públicamente, tarjetas OG, i18n, móvil nativo.

**Escala objetivo:** demo y jurado (decenas–cientos de usuarios). Una sola instancia es suficiente.

## 2. Stack tecnológico

| Capa | Elección |
|---|---|
| Web | Next.js (App Router, `output: 'standalone'`), TypeScript, React Flow (grafo), Framer Motion (animación), Tailwind CSS |
| API | NestJS, TypeScript, TypeORM, `class-validator`, `passport-discord`, `@nestjs/jwt`, `@nestjs/throttler` |
| IA | Claude vía SDK oficial de Anthropic, detrás de puertos; modelo configurable por env; salida validada con `zod` |
| BD | PostgreSQL local en la instancia |
| Tests | Jest (unit de dominio + e2e con supertest en API) |
| Paquetes | pnpm (un `package.json` por paquete, sin monorepo tooling) |
| Hosting | AWS Lightsail · Nginx · certbot · PM2 · GitHub Actions |

## 3. Arquitectura del sistema

```
                 Navegador
                    │  HTTPS
        ┌───────────┴─────────────────────────┐
        ▼                                     ▼
constellation.waldirmaidana.com   backend.constellation.waldirmaidana.com
        │                                     │
        └──────────── Nginx (TLS) ────────────┘
               │ :3000                │ :3001
          PM2: web (Next)        PM2: api (Nest) ──► Anthropic API
                                      │
                                 PostgreSQL :5432 (localhost)
```

### Flujo de autenticación

```
web /  ──clic "Entrar con Discord"──► api GET /v1/auth/discord
api ──302 + state──► discord.com/oauth2/authorize
discord ──302 code+state──► api GET /v1/auth/discord/callback
api: valida state → intercambia code → upsert user (discordId, username, avatar)
api: Set-Cookie cst_session=<JWT>; Domain=.constellation.waldirmaidana.com; HttpOnly; Secure; SameSite=Lax
api ──302──► web /paths (o /assessment si no tiene rutas)
web middleware.ts: sin cookie → redirige a /
```

### Flujo de generación de ruta

```
AssessmentSession (completed)
   │
   ├─► SkillInterpreterPort  (claude | rules)  → SkillProfile { levels por skill, targetSkills, goal }
   │
   ├─► PathPlanner (dominio, determinista)
   │     1. targetSkills → cursos que las enseñan
   │     2. cierre transitivo de prerrequisitos
   │     3. quitar cursos cuyas skills ya domina (nivel ≥ umbral)
   │     4. orden topológico (desempate: nivel, luego duración)
   │
   ├─► RationaleWriterPort  (claude | rules)  → "por qué" por paso
   │
   └─► SSE: profile → step×N → rationale×N → done   (se persiste al emitir done)
```

### Capas por contexto (API)

```
<contexto>/
  domain/          entidades, value objects, servicios de dominio, puertos (interfaces), errores
  application/     casos de uso (un archivo por caso), DTOs de entrada/salida
  infrastructure/  entidades TypeORM, repositorios, adaptadores (claude, rules)
  presentation/    controllers, guards específicos
```

Regla de dependencias: `presentation → application → domain ← infrastructure`. El dominio no importa NestJS ni TypeORM.

## 4. Modelo de datos

Convenciones: PK `uuid`, `created_at`/`updated_at` `timestamptz`, `snake_case`, sin soft-delete.

```
users ─────────┐
               ├──< assessment_sessions ──< assessment_answers
               │            │
               │            └──1 skill_profiles
               │
               └──< learning_paths ──< path_steps >── courses ──< course_skills >── skills
                                                         │
                                                         └──< course_prerequisites (course_id, prerequisite_id)
```

| Tabla | Columnas clave | Constraints |
|---|---|---|
| `users` | `discord_id`, `username`, `avatar_url` | `UNIQUE(discord_id)` |
| `skills` | `slug`, `name`, `area` (`fundamentals`/`frontend`/`backend`/`mobile`/`devops`) | `UNIQUE(slug)` |
| `courses` | `slug`, `title`, `url`, `image_url`, `summary`, `level` (`beginner`/`intermediate`/`advanced`), `duration_hours` | `UNIQUE(slug)` |
| `course_skills` | `course_id`, `skill_id`, `relation` (`teaches`/`requires`) | PK compuesta |
| `course_prerequisites` | `course_id`, `prerequisite_id` | PK compuesta, `CHECK(course_id <> prerequisite_id)` |
| `assessment_sessions` | `user_id`, `status`, `goal_text`, `completed_at` | índice `(user_id)` |
| `assessment_answers` | `session_id`, `question_key`, `answer` `jsonb`, `score` nullable | `UNIQUE(session_id, question_key)` |
| `skill_profiles` | `session_id` (PK/FK), `levels` `jsonb`, `target_skills` `text[]`, `interpreted_by` (`claude`/`rules`) | — |
| `learning_paths` | `user_id`, `session_id`, `name`, `goal`, `status` (`active`/`archived`), `generated_by` | índice `(user_id, status)` |
| `path_steps` | `path_id`, `course_id`, `position`, `rationale`, `completed_at` nullable | `UNIQUE(path_id, course_id)`, `UNIQUE(path_id, position)` |

El catálogo (`skills`, `courses`, `course_skills`, `course_prerequisites`) se carga por seed idempotente (upsert por `slug`) desde `api/src/catalog/infrastructure/seed/catalog.json`.

## 5. Reglas de negocio / máquinas de estado

**AssessmentSession**

```
in_progress ──complete()──► completed   (irreversible)
     └──────abandon()─────► abandoned   (irreversible)
```

- Máximo 10 preguntas por sesión; `complete()` exige al menos 5 respuestas.
- Un usuario tiene como máximo **una** sesión `in_progress`; iniciar otra abandona la anterior.
- Preguntas: banco curado en código (`question-bank.ts`) con ramas por área. Los mini-retos se puntúan de forma determinista. Las preguntas abiertas (objetivo, oferta de trabajo) las interpreta el `SkillInterpreterPort`.
- Selección adaptativa por reglas: la respuesta de área elegida y el acierto/fallo de cada reto determinan la siguiente pregunta (subir o bajar dificultad dentro del área).

**LearningPath**

```
active ⇄ archived        (DELETE elimina de verdad)
```

- Máximo **10 rutas** por usuario (activas + archivadas).
- Rate limit de generación: **5 por usuario por hora**.
- Una ruta tiene entre 1 y 15 pasos. Si el planner devuelve 0 cursos (todo dominado), se responde con error `PATH_NOTHING_TO_LEARN` y sugerencia de subir el objetivo.
- `path_steps.completed_at`: se puede marcar y desmarcar. Marcar un paso cuyos prerrequisitos (dentro de la ruta) no están completos **se permite** (el usuario pudo estudiar por fuera), pero la UI lo advierte.
- Progreso de la ruta = pasos completados / pasos totales (derivado, nunca almacenado).

## 6. Endpoints / contratos

Base: `https://backend.constellation.waldirmaidana.com/v1`. Todas las rutas requieren sesión salvo las marcadas como públicas.

- Éxito: `{ "data": ... }` · Error: `{ "error": { "code": "ASSESSMENT_NOT_FOUND", "message": "..." } }`
- Códigos HTTP estándar; `code` en `SCREAMING_SNAKE_CASE`, estable para el frontend.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/auth/discord` | **Pública.** Inicia OAuth |
| GET | `/auth/discord/callback` | **Pública.** Cierra OAuth, set cookie, redirige a la web |
| POST | `/auth/logout` | Borra cookie |
| GET | `/me` | Usuario actual |
| GET | `/catalog/courses` | Catálogo con skills y prerrequisitos |
| POST | `/assessments` | Inicia sesión → `{ session, question }` |
| POST | `/assessments/:id/answers` | Responde → `{ next: question \| null }` |
| POST | `/assessments/:id/complete` | Cierra y genera `SkillProfile` |
| POST | `/paths/generate` | Body `{ assessmentId, name }`. **Stream SSE** (`profile`, `step`, `rationale`, `done`, `error`) |
| GET | `/paths` | Rutas del usuario con progreso |
| GET | `/paths/:id` | Ruta con pasos, cursos y aristas de prerrequisito |
| PATCH | `/paths/:id` | Renombrar / archivar |
| DELETE | `/paths/:id` | Eliminar |
| PUT | `/paths/:id/steps/:stepId/completion` | Marcar completado |
| DELETE | `/paths/:id/steps/:stepId/completion` | Desmarcar |

**Web (Next.js):** `/` landing + login · `/assessment` entrevista · `/paths` cielo de rutas · `/paths/[pathId]` constelación.

## 7. Decisiones de diseño

- **IA como intérprete, motor determinista como generador** → ADR-0001.
- **OAuth resuelto en la API, sesión JWT en cookie compartida entre subdominios** → ADR-0002.
- **Despliegue en una instancia Lightsail con Nginx + PM2, build en CI** → ADR-0003.
- **Progreso dentro de `learning-path`** en lugar de un contexto propio: un paso completado no tiene reglas fuera de su ruta; separarlo añadiría eventos y sincronización sin beneficio en esta fase.
- **Banco de preguntas curado + selección por reglas** en lugar de preguntas generadas por LLM: los mini-retos necesitan respuesta correcta verificable y la demo debe ser reproducible. La IA aporta donde el texto es libre.
- **Sin monorepo tooling** (Nx/Turborepo): dos paquetes independientes; el costo de configurarlo no se recupera en 11 días.

## 8. Criterios de aceptación

1. Sin sesión, `GET /v1/me` → `401` con `{ error: { code: "UNAUTHENTICATED" } }`; visitar `/paths` redirige a `/`.
2. Login con Discord termina en la web con cookie `cst_session` y `GET /v1/me` devuelve `discordId`, `username`, `avatarUrl` (sin tokens).
3. Una entrevista completa (≥5 respuestas) produce un `SkillProfile`; intentar responder a una sesión `completed` → `409 ASSESSMENT_ALREADY_COMPLETED`.
4. `POST /v1/paths/generate` emite eventos `step` de forma incremental (visible en el navegador en producción, detrás de Nginx) y termina con `done` + `pathId`.
5. Todos los `course_id` de una ruta existen en `courses`, y para todo par con prerrequisito dentro de la ruta, `position(prerrequisito) < position(curso)`.
6. Con `LLM_PROVIDER=rules` (o la API de Anthropic caída) los criterios 3–5 se siguen cumpliendo.
7. Un usuario crea 2+ rutas, marca pasos, recarga y el progreso persiste; otro usuario recibe `404` al pedir esas rutas.
8. La 6ª generación en una hora → `429`.
9. Ambos subdominios responden por HTTPS con certificado válido; el puerto 5432 no es accesible desde internet.
