# ADR 0000: Registrar decisiones de arquitectura como ADR

- **Estado:** Aceptado
- **Fecha:** 2026-09-16
- **Capas afectadas:** proceso

## Contexto

Las decisiones técnicas cross-capa (por qué se eligió X, qué se descartó y por qué) se pierden si solo viven en la cabeza de quien las tomó o en un hilo de chat. Meses después alguien re-litiga lo mismo o, peor, revierte una decisión sin conocer su motivo.

## Decisión

Registramos toda decisión de arquitectura no trivial como un ADR corto en `docs/adr/`, numerado e inmutable. Una decisión revertida no se borra: se crea un ADR nuevo que la supersede.

## Alternativas descartadas

- **No documentar** — barato hoy, caro en cada re-discusión futura.
- **Solo en CLAUDE.md** — CLAUDE.md dice *qué hacer ahora*, no *por qué se decidió así* ni qué se descartó; mezclar ambas cosas lo vuelve ilegible.

## Consecuencias

Un archivo más por decisión relevante (coste bajo). El convenio: convención de un punto → «Gotchas» de CLAUDE.md; decisión con alternativas → ADR; feature nueva → spec viva.
