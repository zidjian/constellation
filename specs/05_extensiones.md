# Extensiones — Post fase inicial (spec viva)

Los specs `00`–`0N` describen el **diseño congelado** y no se editan. Este documento es **vivo**: registra las features añadidas después del MVP. La fuente de verdad operativa sigue siendo `CLAUDE.md`; aquí queda el *qué* y el *porqué* de cada extensión, con punteros al código, ADR y migraciones.

> **Regla de mantenimiento:** toda feature nueva que toque varias capas añade su entrada aquí (1–2 párrafos + endpoints + tablas afectadas) en el mismo cambio que la implementa. Si establece una convención no obvia → también a «Gotchas» de `CLAUDE.md`. Si es una decisión con alternativas → también un ADR en `docs/adr/`.

## Índice

_TEMPLATE: añade una sección por feature a medida que aterrizan. Formato sugerido por entrada:_

## N. {{Nombre de la feature}}

- **Qué:** {{una o dos líneas}}
- **Endpoints / rutas:** {{nuevos o modificados}}
- **Datos:** {{tablas/columnas/migración}}
- **Punteros:** {{ADR-XXXX, archivos clave}}

## 1. Simulacro de entrevista con reclutador

- **Qué:** modo alternativo de la entrevista. En vez del cuestionario guiado, Claude conduce una entrevista de trabajo real sobre una oferta que pega la persona: repregunta cuando la respuesta se va por las ramas, lanza mini-retos del banco curado cuando quiere ver código, y cierra entre 5 y 12 intercambios. De ahí salen los niveles por skill (cada uno con la **cita literal** que lo respalda), los objetivos y un **informe** con fortalezas, brechas y qué se esperaba escuchar. Con el perfil resultante se genera la ruta igual que siempre.
- **Quién decide qué:** el modelo solo **propone**; `sanitizeDecision` (dominio) valida contra el catálogo y el banco de retos, recorta niveles, exige cita, impide cerrar antes del mínimo y obliga a cerrar en el máximo. El `PathPlanner` sigue siendo el único que decide cursos (ADR-0001).
- **Modelos y coste:** conduce `claude-sonnet-5` (`ANTHROPIC_INTERVIEW_MODEL`) con *prompt caching* (~3.100 tokens de caché leídos por turno frente a ~55 nuevos); el informe final lo redacta el modelo principal. Se apaga con `RECRUITER_ENABLED=false` (valor por defecto y el de producción hasta aprobarlo).
- **Endpoints:** `POST /v1/assessments/recruiter` (inicia, 3/h), `POST /v1/assessments/:id/recruiter/reply` (turno: `text` o `optionId` de reto, 60/h), `GET /v1/assessments/:id/recruiter` (retomar lo conversado, sin LLM), `GET /v1/assessments/:id/report` (informe; lo regenera si falló al completar), `GET /v1/assessments/modes` (qué modos ofrece el servidor).
- **Datos:** `assessment_sessions.mode` (`guided` | `recruiter`, con CHECK) y la tabla `interview_reports` (`session_id` PK + `report` jsonb, FK con ON DELETE CASCADE), migración `AddRecruiterMode`. La conversación vive en `answers` con claves `ask:N` / `rep:N` / `chq:<id>` / `lvl:N` / `tgt:N` / `end:N`.
- **Punteros:** `api/src/assessment/domain/recruiter.ts`, `application/recruiter.use-cases.ts`, `infrastructure/claude-recruiter.ts`, ADR-0001.

## 2. Cuenta con correo y contraseña

- **Qué:** además de Discord, se puede crear una cuenta con correo y contraseña, entrar con ella y recuperarla por un enlace que llega al correo. Discord deja de ser obligatorio para usar el producto (el jurado, o quien no tenga Discord, ya puede entrar).
- **Seguridad:** contraseñas con `scrypt` (sal por usuario; el hash guarda sus parámetros). Los tokens de recuperación se guardan **hasheados** con SHA-256, caducan en 1 hora, sirven una vez y pedir otro invalida el anterior. `forgot-password` responde siempre lo mismo exista o no la cuenta, y el login tarda lo mismo con correo inexistente que con contraseña mala (se calcula un hash de descarte).
- **Correo:** Resend por HTTP (`ResendMailer`). Sin `RESEND_API_KEY` el enlace se escribe en el log, así que el flujo se prueba en local y en los e2e sin salir a la red. Un fallo al enviar se registra y no cambia la respuesta.
- **Endpoints:** `POST /v1/auth/register` (10/h por IP), `POST /v1/auth/login` (10 cada 15 min), `POST /v1/auth/forgot-password` (5/h), `POST /v1/auth/reset-password` (10/h). Los cuatro dejan la cookie de sesión puesta salvo `forgot-password`.
- **Datos:** `users.email` (único) y `users.password_hash`; `users.discord_id` pasa a opcional con un CHECK que exige Discord **o** correo+contraseña. Tabla `password_reset_tokens` (`token_hash` único, `expires_at`, `used_at`). Migración `AddEmailAuth`, verificada up/down/up.
- **Web:** `/registro`, `/entrar`, `/recuperar` y `/restablecer?token=…`. La landing ofrece las dos formas de entrar.
- **Punteros:** `api/src/identity/application/email-auth.use-cases.ts`, `infrastructure/scrypt-password-hasher.ts`, `infrastructure/resend-mailer.ts`, `web/src/features/auth/auth-forms.tsx`.

## 3. Edición del perfil

- **Qué:** pantalla `/perfil` con cuatro bloques: nombre visible, correo, contraseña y eliminar la cuenta.
- **Reglas transversales:** todo cambio sensible (correo, contraseña, borrado) pide la **contraseña actual** si la cuenta tiene una, para que una sesión robada no se quede con la cuenta. Cambiar la contraseña invalida los enlaces de recuperación pendientes.
- **Cambio de correo con verificación:** el correo nuevo **no entra** en `users` hasta confirmarlo desde él. El token va hasheado (SHA-256), caduca en 1 hora, sirve una vez y pedir otro invalida el anterior. Si Resend no acepta el envío, la petición falla y nada queda a medias.
- **Cuentas de Discord:** pueden añadir correo (sin contraseña previa) y, una vez confirmado, ponerse contraseña. Desde ese momento entran por cualquiera de las dos vías.
- **Eliminar la cuenta:** borra usuario, rutas, progreso y entrevistas en cascada. Con contraseña se exige la contraseña; sin ella (Discord) hay que escribir `ELIMINAR`. Se limpia la cookie de sesión.
- **Endpoints:** `PATCH /v1/me`, `POST /v1/me/password` (10/h), `POST /v1/me/email` (5/h), `POST /v1/me/email/confirm` (**público**: el enlace se abre donde no hay sesión; el token es la prueba), `DELETE /v1/me` (5/h).
- **Datos:** tabla `email_change_tokens` (`new_email`, `token_hash` único, `expires_at`, `used_at`). Migración `AddEmailChangeTokens`.
- **Web:** `/perfil` (protegida por `proxy.ts`) y `/perfil/confirmar-correo?token=…` (pública a propósito).
- **Punteros:** `api/src/identity/application/profile.use-cases.ts`, `web/src/features/auth/profile-forms.tsx`.

## 4. Cursos terminados

- **Qué:** pantalla `/completados` con todos los cursos que la persona ya encendió, de **todas** sus rutas, sin repetir: un curso que aparece en dos rutas cuenta una vez, con la fecha en que lo marcó la primera vez, y enlaza a las rutas donde está. Arriba, el total de cursos y de horas invertidas.
- **Por qué:** el progreso solo se veía ruta por ruta; no había forma de responder «¿qué llevo hecho?».
- **Endpoint:** `GET /v1/paths/completed`. Va declarado **antes** de `GET /v1/paths/:id`, o Nest intentaría leer `completed` como UUID.
- **Datos:** ninguno nuevo. Se deriva de `path_steps.completed_at`, coherente con la invariante de que el progreso no se almacena agregado.
- **Navegación:** la cabecera de la app pasa a tener «Mis rutas · Terminados · Perfil» visibles también en móvil («Nueva ruta» solo en escritorio, porque se llega desde el cielo). La marca esconde el nombre en móvil para que quepa.
- **Punteros:** `ManagePathsUseCases.completedCourses`, `web/src/app/(app)/completados/page.tsx`.

## 5. Catálogo navegable

- **Qué:** pantalla `/cursos` con los 74 cursos del catálogo. Buscador por nombre, descripción o tecnología (sin tildes: «programacion» encuentra «programación»), y filtros por área, nivel y estado (todos · me faltan · terminados). El contador dice cuántos cursos y cuántas horas quedan a la vista.
- **Dónde vive el filtrado:** en el cliente. Son 74 cursos, ya vienen en una sola respuesta de `GET /v1/catalog/courses`, y así filtrar no cuesta ni una petición.
- **Iconos y motion:** `lucide-react` para los iconos, y entradas escalonadas con Motion en las listas (`components/ui/reveal.tsx`). La sección activa de la navegación se marca con una línea que se desplaza (`layoutId`). Todo respeta `prefers-reduced-motion`: el contenido es visible aunque no anime.
- **Navegación:** «Mis rutas · Catálogo · Terminados · Nueva ruta · Perfil», con icono cada una. En escritorio va arriba; en móvil baja a una barra fija al alcance del pulgar, con etiquetas cortas, porque cinco destinos no caben en la cabecera junto a la marca y la sesión.
- **Punteros:** `web/src/features/catalog/catalog-browser.tsx`, `web/src/app/(app)/cursos/page.tsx`, `web/src/features/auth/app-nav.tsx`.
