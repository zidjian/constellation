# ADR 0001: La IA interpreta y explica; un motor determinista genera la ruta

- **Estado:** Aceptado
- **Fecha:** 2026-09-16
- **Capas afectadas:** api (assessment, learning-path) / web

## Contexto

La app debe generar rutas "dinámicas" sobre el catálogo real de DevTalles. Un LLM que arma la ruta completa puede inventar cursos, ignorar prerrequisitos o devolver órdenes distintos para la misma entrada. En una hackathon juzgada por DevTalles, un curso inexistente en pantalla es un fallo visible e inmediato. Además, la demo en vivo no puede depender de la disponibilidad de una API externa.

## Decisión

Dividimos la generación en tres piezas:

1. **`SkillInterpreterPort`** (LLM): convierte respuestas libres + resultados de retos en un `SkillProfile` estructurado. Su salida se valida con `zod` contra los slugs de skills existentes; lo que no valida se descarta.
2. **`PathPlanner`** (servicio de dominio puro, determinista): del perfil al conjunto ordenado de cursos (cierre de prerrequisitos + orden topológico). Es la única pieza que decide qué cursos entran.
3. **`RationaleWriterPort`** (LLM): redacta el "por qué" de cada paso ya decidido.

Los dos puertos tienen un adaptador `rules` que se usa ante error, timeout (8 s) o `LLM_PROVIDER=rules`.

## Alternativas descartadas

- **LLM genera la ruta completa** — alucinaciones, sin garantía de prerrequisitos, no testeable.
- **LLM elige cursos restringido a un enum de IDs** — evita cursos inventados, pero no garantiza el orden ni el cierre de prerrequisitos; habría que validar y corregir igual.
- **Solo reglas, sin IA** — cumple los requisitos pero pierde la interpretación de texto libre ("pega una oferta de trabajo") y la explicación personalizada, que son el diferenciador.

## Consecuencias

- La invariante "una ruta solo contiene cursos del catálogo y respeta prerrequisitos" se garantiza en dominio y se cubre con tests unitarios de `PathPlanner`.
- La misma entrada interpretada produce la misma ruta: la demo es reproducible.
- Costo: mantener el catálogo con skills y prerrequisitos bien etiquetados (`catalog.json`), que pasa a ser el activo más importante del proyecto.
