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
