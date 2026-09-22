# Plantilla de proyecto asistido por Claude

Un punto de partida para tu **próxima idea de desarrollo**, destilado de lo que funciona (y de los errores que costaron tiempo) en proyectos reales con Claude Code. No es un boilerplate de código: es el **andamiaje de documentación y proceso** que hace que el desarrollo asistido sea coherente entre sesiones y entre personas.

---

## Por qué existe (la idea de fondo)

La documentación de un proyecto tiende a correr a **tres velocidades**: el código avanza rápido, el `CLAUDE.md` lo sigue a medias, y las specs/agentes se congelan el primer día y empiezan a **mentir**. Un agente que lee documentación falsa toma malas decisiones.

Esta plantilla impone una disciplina simple:

> **El código es la verdad. `CLAUDE.md` es el SSOT vivo que la describe. Todo lo demás se subordina a ellos y se reconcilia.**

Y un **circuito de retroalimentación** para que el conocimiento no se pierda: cada cosa no obvia que aprendes tiene un lugar donde vivir.

---

## Qué incluye

```
.
├── CLAUDE.md                      # SSOT vivo: invariantes, comandos, gotchas, Definition of Done
├── README.md                      # (esta guía)
├── .claude/
│   ├── agents/                    # architect · implementer · reviewer (+ cómo especializar)
│   └── commands/                  # /nueva-feature /cambio-db /verificar /sync-docs
├── docs/
│   └── adr/                       # decisiones con su porqué (inmutables) + plantilla
└── specs/
    ├── 00_especificaciones.md     # diseño CONGELADO de la fase inicial
    └── 05_extensiones.md          # spec VIVA (toda feature nueva añade entrada)
```

Por paquete/servicio, además, puedes crear un `CLAUDE.md` delgado con los *gotchas* locales (apunta al raíz).

---

## Cómo empezar

1. **Copia** el contenido de `template/` a la raíz de tu repo nuevo.
2. **Reemplaza los placeholders** `{{...}}` (lista abajo) y borra las notas marcadas con _«TEMPLATE: …»_.
3. **Llena `CLAUDE.md`**: visión, stack, invariantes, comandos. Deja «Gotchas» vacía — se llena sola con el tiempo.
4. **Escribe `specs/00_especificaciones.md`** antes de implementar (el diseño de la fase). Congélalo al arrancar.
5. **Especializa los agentes** si tu proyecto tiene capas diferenciadas (clona `implementer` en `backend`/`frontend`/…).
6. **Primer commit incluye el ADR 0000** (ya viene) — deja constancia de que usarás ADRs.
7. A partir de ahí, sigue el flujo de abajo.

### Placeholders a reemplazar

`{{PROYECTO}}` · `{{stack}}` · puertos y comandos en `CLAUDE.md` · `{{AAAA-MM-DD}}` en los ADR · descripciones de los agentes.

---

## El flujo de desarrollo asistido

```
   idea
    │
    ▼
[architect]  diseña → análisis / ADR.  Pregunta lo que es del negocio (no asume).
    │                                   ⟵ usa AskUserQuestion para decisiones del usuario
    ▼
[implementer]  ejecuta el diseño: código + tests. Respeta invariantes y gotchas.
    │
    ▼
 verificar     build + tests + SMOKE REAL (no "debería funcionar").  → /verificar
    │
    ▼
[reviewer]   revisa el diff contra invariantes + gotchas + Definition of Done.
    │
    ▼
 reconciliar  ¿aprendí algo no obvio? → al lugar correcto (ver matriz).  → /sync-docs
```

Para tareas pequeñas puedes saltarte architect/reviewer; para features que tocan varias capas, no.

---

## ¿Dónde va cada conocimiento? (la matriz)

| Lo que aprendiste | Dónde vive | Por qué |
|---|---|---|
| Convención no obvia de un punto (gotcha) | `CLAUDE.md` → **Gotchas** | Se consulta siempre; evita repetir el error |
| Decisión con alternativas / *porqué* | `docs/adr/` | Para no re-litigar; histórico inmutable |
| Feature nueva (qué se construyó) | `specs/05_extensiones.md` | Spec viva; mapa del sistema |
| Diseño inicial de la fase | `specs/00_*` (congelado) | Intención original; no se edita |
| Estado real operativo (comandos, invariantes…) | `CLAUDE.md` (raíz/paquete) | SSOT vivo |
| Preferencia del usuario / contexto de proyecto | memoria del agente (`.claude/agent-memory/`) | Persiste entre conversaciones; no es del código |

Regla de prioridad ante conflicto: **código → CLAUDE.md → ADR → specs/agentes**.

---

## Mejores prácticas

1. **CLAUDE.md primero, siempre.** Todo agente lo lee antes de tocar nada. Si no está documentado, propón y decide con el usuario antes de improvisar.
2. **Diseña antes de construir** las features grandes. Un buen análisis hace la implementación mecánica.
3. **Pregunta lo que es del negocio.** Alcance, qué datos exponer, permisos: usa preguntas explícitas en vez de asumir. Asumir mal cuesta más que preguntar.
4. **Verifica de verdad.** Levanta el servicio y prueba el endpoint/página reales. "Compila" no es "funciona".
5. **Captura lo no obvio al cerrar cada feature.** El último paso de implementar algo no trivial es preguntarte *"¿qué no era evidente aquí?"* y mandarlo a su lugar (gotcha / ADR / spec viva).
6. **Nada de datos quemados.** Lo configurable va a config/entorno o BD, no al código.
7. **Subordina specs y agentes al código.** Trátalos como "foto del día que se escribieron". Corre `/sync-docs` cada cierto tiempo para cazar la deriva.
8. **Esquema solo por migración** versionada y reversible; nunca auto-sync. Seeds idempotentes con backfill explícito.
9. **Seguridad por defecto.** Permisos explícitos por ruta, no exponer campos internos, validar/re-procesar uploads, rate-limit donde duela.
10. **Reporta honestamente.** Si un test falla o algo quedó sin probar, dilo con su salida. La confianza se construye con precisión, no con optimismo.

---

## Anti-patrones (errores reales que esta plantilla previene)

- **Documentación a tres velocidades** → specs/agentes que mienten. _Mitigación: matriz + `/sync-docs`._
- **Agentes obsoletos** que afirman un stack que ya cambió. _Mitigación: subordinar al código; banner de "estado real" cuando deriven._
- **Caché que oculta la frescura** (cachear datos mutables y creer que "no se guardó"). _Mitigación: datos mutables = dinámicos, sin caché silenciosa._
- **"Debería funcionar"** sin haberlo corrido. _Mitigación: smoke real en la Definition of Done._
- **Upsert que ignora conflictos para backfill** (no actualiza filas existentes). _Mitigación: backfill explícito._
- **Asumir el comportamiento de un guard/framework** sin verificar. _Mitigación: leer el código antes de proponer._

---

## Agentes y comandos

**Agentes** (`.claude/agents/`): `architect` (diseña), `implementer` (construye), `reviewer` (revisa/verifica). Ver `.claude/agents/README.md` para cómo especializarlos por capa.

**Comandos** (`.claude/commands/`, se invocan como `/nombre`):
- `/nueva-feature <nombre>` — andamia una feature respetando convenciones.
- `/cambio-db <descripción>` — crea y aplica una migración con el naming del proyecto.
- `/verificar [feature]` — verificación end-to-end contra la Definition of Done.
- `/sync-docs [área]` — detecta deriva docs ↔ código.

---

## Mantenimiento

- **Cada feature** termina actualizando el lugar correcto (matriz). Es parte de la Definition of Done.
- **Periódicamente** (o antes de un hito) corre `/sync-docs` para reconciliar.
- **La memoria del agente** es para lo no obvio y duradero (preferencias, contexto), no para lo que ya está en el código o en CLAUDE.md.

> Mantener esto vivo cuesta minutos por feature y ahorra horas de re-derivar lo mismo. Esa es toda la apuesta.
