# ADR 0004: Extraer el catálogo offline del sitio público de DevTalles y curarlo en un seed versionado

- **Estado:** Aceptado
- **Fecha:** 2026-09-16
- **Capas afectadas:** api (catalog) / tooling / datos

## Contexto

El `PathPlanner` necesita el catálogo real de DevTalles con nivel, skills y prerrequisitos (ADR-0001), y DevTalles no ofrece una API pública. Lo que encontramos al revisar el sitio el 2026-09-16:

- `devtalles.com` redirige a `cursos.devtalles.com`, que corre sobre **Thinkific**. La Admin API de Thinkific existe, pero exige la clave de administrador de la escuela, y esa clave no la tenemos.
- `cursos.devtalles.com/sitemap.xml` es público y enumera 91 URLs `/courses/*`. `robots.txt` solo bloquea `/enroll`, `/order` y `/certificates`.
- Cada página de curso expone título, resumen e imagen (`og:*`), lecciones, horas de video, instructor, **"Requisitos previos"** en texto libre, descripción y temario por capítulos. Las páginas *legacy* no tienen el bloque de requisitos ni el de descripción.
- DevTalles publica **rutas oficiales** (`/pages/ruta-*` y `/pages/programas-*`). Cada una es una rejilla con cada curso clasificado como REQUERIDO, RECOMENDADO u OPCIONAL, una etiqueta de área y **flechas entre cursos** (`new LeaderLine({ start, end })`). En total son 13 páginas, 75 cursos y 89 aristas.
- Las páginas `/pages/todos-los-cursos-*` clasifican los cursos en gratuitos, legacy, minicursos, exclusivos y en construcción.
- Lo que el sitio **no** expone de forma estructurada: el nivel del curso y las skills.

## Decisión

El catálogo se construye en tres pasos, ninguno en tiempo de ejecución:

1. **Extraer.** `tools/catalog/extract-devtalles.mjs` (Node, sin dependencias, 1 petición por segundo, User-Agent identificable) lee el sitemap, las rutas oficiales, las categorías y cada curso. Escribe `tools/catalog/catalog.raw.json`, un snapshot factual versionado que no se edita a mano.
2. **Curar.** `catalog-curator` produce `api/src/catalog/infrastructure/seed/catalog.json` a partir del snapshot:
   - descarta lo que no sirve para rutas (legacy reemplazados, en construcción, "+DevTalles", duplicados);
   - toma los **prerrequisitos de las aristas oficiales** como base, quitando las aristas transitivas redundantes;
   - asigna nivel y skills (`teaches`/`requires`) apoyándose en "Requisitos previos", temario y etiqueta de área. La IA puede proponer, pero cada curso lo revisa una persona.
3. **Validar y sembrar.** El validador (slugs, referencias, DAG, coherencia de nivel) corre en CI, y `pnpm seed` hace upsert idempotente en PostgreSQL.

La web enlaza a la URL pública del curso y usa la imagen desde el CDN de Thinkific; no copia contenido multimedia.

## Alternativas descartadas

- **Thinkific Admin API**: requiere credenciales de administrador de DevTalles. Si la organización las ofrece o entrega un export oficial, ese export **manda** sobre el snapshot (el curador ya lo contempla), pero no bloqueamos el proyecto esperándolo.
- **Scraping en tiempo de ejecución o por cron en producción**: la demo pasaría a depender de un sitio externo y de su markup, y los slugs podrían cambiar bajo rutas ya guardadas. Rompe la invariante "la demo nunca depende de una API externa".
- **Catálogo escrito a mano desde cero**: más lento y más propenso a errores en títulos, URLs y duraciones, y además desaprovecha las rutas oficiales que DevTalles ya publica.
- **Que el LLM infiera prerrequisitos sin las aristas oficiales**: menos fiable y difícil de defender ante un jurado de DevTalles. Las aristas oficiales son la mejor fuente disponible.

## Consecuencias

- Los datos factuales son reales y trazables a una fecha de extracción. Las decisiones de curación quedan en el diff de `catalog.json`.
- Si el sitio cambia, se vuelve a correr el extractor y se revisa el diff del snapshot. `catalog.json` **no** se regenera automáticamente: cambiar un slug rompe rutas guardadas.
- Las páginas de ruta tienen ids de caja duplicados o erróneos, lo que deja 6 aristas sin resolver. El extractor las reporta en `unresolvedEdges` y el curador las decide a mano.
- Se avisa a DevTalles en el Discord de la hackathon de que usamos su catálogo público.
