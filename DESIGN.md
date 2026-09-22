# Design

Sistema visual de Constellation. La estrategia vive en `PRODUCT.md` y los tokens en `web/src/app/globals.css` (`@theme` de Tailwind 4).

## Theme

Claro, sobre **blanco puro**. Escena: una persona abre el enlace desde Discord, en portátil de noche o en el móvil, perdida entre 70 cursos, y quiere ver un plan que se enciende.

La "constelación" es **estructura**: puntos unidos que forman una figura con sentido. No hay fondo espacial, campo de estrellas, nebulosas ni neón (anti-referencia explícita en PRODUCT.md).

## Color (OKLCH, estrategia *restrained*)

| Rol | Token | Valor | Uso |
|---|---|---|---|
| Fondo | `bg` | `oklch(1 0 0)` | Superficie base |
| Superficies | `surface`, `surface-2` | `oklch(0.972 0.005 258)`, `oklch(0.945 0.008 258)` | Paneles, lienzo del grafo, skeletons |
| Líneas | `line`, `line-strong` | `oklch(0.9 0.01 258)`, `oklch(0.8 0.015 258)` | Bordes, "orden sugerido" |
| Tinta | `ink`, `ink-muted` | `oklch(0.24 0.035 258)` (15:1), `oklch(0.46 0.025 258)` (7.2:1) | Texto |
| **Ámbar miel** | `primary`, `primary-hover`, `primary-soft` | `oklch(0.8 0.16 70)` | Estrella encendida y acción primaria. **Solo** progreso real y CTA |
| Ámbar texto | `primary-strong` | `oklch(0.5 0.12 55)` (5.1:1) | Texto en ámbar. El ámbar claro nunca va como texto sobre blanco |
| Tinta azul | `accent`, `accent-soft` | `oklch(0.47 0.13 258)` (7:1) | Prerrequisito cumplido, estrella disponible, foco, selección |
| Estrella apagada | `star-off` | `oklch(0.62 0.02 258)` (3.4:1, gráfico) | Estrella con prerrequisitos pendientes |
| Estado | `danger`, `danger-soft`, `success` | — | Errores y confirmaciones destructivas |

El texto sobre el botón primario es `ink`, no blanco: el blanco sobre ámbar no llega a AA.

## Typography

Una sola familia: **Geist** (sans) para todo, y **Geist Mono** para el código de los mini-retos. La escala es fija en rem y de ratio corto (registro product). `h1–h3` llevan `text-wrap: balance` y `letter-spacing: -0.02em`; la prosa lleva `text-wrap: pretty` y como mucho unos 70ch.

## La estrella (componente núcleo)

`web/src/components/ui/star.tsx`. El estado se distingue por **forma y color** (WCAG 1.4.1):

- **Completada:** disco ámbar con check en tinta; brillo (`drop-shadow` con `--color-glow`) cuando se acaba de encender.
- **Disponible:** aro de tinta azul con núcleo. Si es la *siguiente*, lleva un pulso suave (`animate-star-pulse`).
- **Bloqueada:** aro gris punteado.

## Constelación

`web/src/features/constellation/`. Usa React Flow, pero **no** con un layout de grafo automático: dispone las estrellas en **zigzag según el orden de la ruta** (boustrofedón), así la figura siempre se lee como un recorrido, aunque los cursos no dependan entre sí.

- **Líneas rectas de estrella a estrella**, como en una constelación real.
  - Continua: prerrequisito. Es azul si el de origen está completado y gris si no.
  - Punteada: orden sugerido entre pasos consecutivos sin prerrequisito.
- **Rejilla por ancho del contenedor:** 4 o 3 columnas con título. Por debajo de 480 px pasa a **modo compacto** (estrella y número): el título está en la lista y en el panel.
- El grafo no se monta hasta conocer su ancho. Así el primer `fitView` encuadra la rejilla correcta.
- **Accesibilidad:**
  - cada estrella es un `<button>` con `aria-label` (posición, título y estado);
  - la **lista "Pasos en orden"** es la alternativa completa por teclado y lector de pantalla;
  - la leyenda explica los dos tipos de línea.

## Motion (Motion 13, 150–500 ms, `ease-out` quint/expo, nada de rebotes)

- **Estrellas que aparecen:** escala 0.6 → 1 con fade.
- **Prerrequisitos:** se dibujan con `pathLength`.
- **Estrella encendida:** escala y giro en el panel, y aviso "¡Estrella encendida!".
- **Entrevista:** transición corta entre preguntas; los puntos de progreso se encienden en ámbar al responder.
- **Hero:** trazo dibujado al cargar. La figura es visible sin animación, porque el trazo realza y no revela.
- **`prefers-reduced-motion`:** sin desplazamientos ni dibujado; solo fundidos o cambios instantáneos (regla global en `globals.css`).

## Components

- **`Button` / `ButtonLink`:** variantes `primary`, `secondary`, `ghost`, `danger`; tamaños `sm`, `md`, `lg`; estados hover, focus, active, disabled y loading (spinner con `aria-busy`).
- **Formularios de la entrevista:** inputs nativos (`radio`, `textarea`) estilizados con `has-[:checked]`; el teclado funciona sin código extra.
- **Confirmaciones inline** en lugar de modales: eliminar ruta y marcar un curso con prerrequisitos pendientes.
- **Estados vacíos que enseñan:** "Aún no tienes rutas…" con la acción que lleva a crear la primera.
- **Capas:** escala semántica en `:root` (`--z-dropdown` … `--z-toast`). Nada de valores arbitrarios.

## Verificación

- **axe-core, WCAG 2.2 AA:** 0 violaciones en landing, mis rutas, detalle, y en la entrevista (objetivo, área, autoevaluación y reto), con `reducedMotion: reduce`.
- **Sin scroll horizontal a 390 px.**
