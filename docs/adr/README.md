# Architecture Decision Records (ADR)

Decisiones técnicas con impacto cross-capa o no obvio, registradas para no re-derivarlas. Cada ADR es corto (≈1 página) e **inmutable**: si una decisión se revierte, se crea un ADR nuevo que la supersede (no se borra el viejo).

**Cuándo escribir un ADR:** cuando una decisión afecta varias capas, contradice una intuición, o establece una convención que el código por sí solo no explica **y** hubo alternativas reales que descartar. Las convenciones de un solo punto van a «Gotchas» de `CLAUDE.md`; las decisiones con *porqué* y alternativas van aquí.

Plantilla: [`_template.md`](_template.md). Empieza por [`0000-usar-adrs.md`](0000-usar-adrs.md).

| # | Decisión | Estado |
|---|---|---|
| [0000](0000-usar-adrs.md) | Registrar decisiones de arquitectura como ADR | Aceptado |
| [0001](0001-ia-interpreta-motor-determinista-genera.md) | La IA interpreta y explica; un motor determinista genera la ruta | Aceptado |
| [0002](0002-oauth-en-api-cookie-entre-subdominios.md) | OAuth de Discord en la API y sesión JWT en cookie compartida entre subdominios | Aceptado |
| [0003](0003-despliegue-lightsail-nginx-pm2.md) | Desplegar en una instancia Lightsail con Nginx + PM2 y build en CI | Aceptado |
| [0004](0004-catalogo-extraido-offline-del-sitio-publico.md) | Extraer el catálogo offline del sitio público de DevTalles y curarlo en un seed versionado | Aceptado |
