# Agentes de DevTalles Constellation

| Agente | Rol | Escribe código |
|---|---|---|
| `architect` | Diseña features, contratos, esquema y ADRs | No (solo docs) |
| `catalog-curator` | Construye y valida `catalog.json` (cursos, skills, prerrequisitos) | Solo el catálogo y su validador |
| `backend-implementer` | NestJS con DDD en `api/` + tests + migraciones | Sí |
| `frontend-implementer` | Next.js en `web/`, diseño con la skill `impeccable` | Sí |
| `devops` | Lightsail, Nginx, PM2, GitHub Actions, ramas, licencia | Sí (infra) |
| `reviewer` | Revisa contra invariantes y Definition of Done | No |

## Flujo

```
architect ──► catalog-curator (si toca el catálogo)
    │
    ├──► backend-implementer ──┐
    └──► frontend-implementer ─┴──► reviewer ──► PR a develop
                                        │
devops: CI/CD y despliegue ─────────────┘   main ◄── develop (release)
```

- Features de varias capas: `architect` → implementers → `reviewer`. Tareas pequeñas y acotadas pueden ir directo al implementer.
- Todos leen `CLAUDE.md` antes de actuar y proponen gotchas nuevos al terminar.
- Los agentes no hablan con el usuario durante su ejecución: las decisiones de negocio vuelven como **Preguntas para el usuario** en su reporte.

## Skills y plugins del proyecto

| Skill / plugin | Origen | Uso | Quién la usa |
|---|---|---|---|
| `impeccable` | usuario | Flujo y criterio final de UI (crea `PRODUCT.md` en su primer uso) | `frontend-implementer` (precargada) |
| `emil-design-eng` | [emilkowalski/skills](https://github.com/emilkowalski/skills) (MIT) | Filosofía de pulido y movimiento | `frontend-implementer` (precargada) |
| `animate` | emilkowalski/skills | Construir una animación desde cero | `frontend-implementer` |
| `find-animation-opportunities` | emilkowalski/skills | Dónde sí y dónde no animar (solo lectura) | `frontend-implementer` |
| `improve-animations` | emilkowalski/skills | Auditoría de motion de toda la app (solo lectura) | usuario, antes del video |
| `review-animations` | emilkowalski/skills | Revisión estricta de motion; **solo la invoca el usuario** (`/review-animations`) | usuario; `reviewer` lee sus archivos |
| `animation-vocabulary` | emilkowalski/skills | Nombrar efectos de movimiento | cualquiera |
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT) | Base de datos de estilos, paletas, tipografías y guías UX; genera el design system | `frontend-implementer` |
| `caveman` | usuario | Respuestas comprimidas (`/caveman`) | usuario |
| plugin `frontend-design` | Anthropic (oficial) | Dirección estética distintiva | `frontend-implementer` |
| plugin `context7` | oficial | Documentación actualizada de librerías | todos |
| plugin `typescript-lsp` | oficial | Inteligencia de código TS (requiere `npm i -g typescript-language-server typescript`) | todos |

**Precedencia de diseño** si se contradicen: `impeccable` → `emil-design-eng`/`animate` (movimiento) → `ui-ux-pro-max` (datos) → `frontend-design`.

**Modificación local:** en `ui-ux-pro-max/SKILL.md` se cambió `${CLAUDE_PLUGIN_ROOT}/.claude/skills/ui-ux-pro-max` por `.claude/skills/ui-ux-pro-max`, porque aquí está instalada como skill de proyecto y no como plugin. Se ejecuta desde la raíz del repo. Se omitieron sus `scripts/tests`.
