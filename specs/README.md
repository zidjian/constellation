# specs/ — diseño del proyecto

Dos velocidades, a propósito:

- **`00_especificaciones.md` (y `01`, `02`… si los necesitas) = diseño CONGELADO de la fase inicial.** Captura la intención original: stack, esquema, contratos, decisiones. **No se edita** una vez arrancada la implementación; envejece y eso está bien — sirve de contexto histórico. No esperes que refleje features posteriores.

- **`02_plan_implementacion.md` = plan de ejecución del MVP.** Fases, tareas, ramas y verificaciones por día. Durante la fase solo se marcan casillas y se anotan desvíos en su §9; no es fuente de verdad de diseño.

- **`05_extensiones.md` = spec VIVA.** Aquí entra todo lo que se construye después del MVP. **Regla:** toda feature nueva que toque varias capas añade su entrada en el mismo cambio que la implementa.

¿Por qué separarlas? Porque mezclar diseño congelado con estado actual produce documentación que miente. La verdad operativa del día a día vive en `CLAUDE.md`; las specs dan el *qué* y el *porqué*, y los ADR (`docs/adr/`) las decisiones puntuales.

> Numeración sugerida: `00` especificaciones generales, `01` diseño/UI, `02..0N` planes por servicio. Adáptala a tu proyecto.
