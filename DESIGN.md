# Design

Sistema visual de Constellation. La estrategia vive en `PRODUCT.md`, el porqué del rediseño en `specs/06_rediseno_sala_de_control.md` y los tokens en `web/src/app/globals.css` (`@theme` de Tailwind 4).

## Theme

**Sala de control**: superficie carbón azulado y una sola regla que ordena todo —**la luz significa progreso**—. Escena: son las once de la noche, la persona abre el enlace desde el Discord de DevTalles después de currar, y quiere ver su plan sin que la pantalla le queme la cara; enciende una estrella y la habitación se ilumina un poco.

La "constelación" es **estructura**: puntos unidos que forman una figura con sentido. Carbón plano: no hay campo de estrellas, nebulosas, neón ni degradados (anti-referencia explícita de PRODUCT.md). El fondo oscuro no es una excusa para el cliché espacial.

## Color (OKLCH, estrategia *committed*)

| Rol | Token | Valor | Uso |
|---|---|---|---|
| Fondo | `bg` | `oklch(0.17 0.012 258)` | Superficie base |
| Superficies | `surface`, `surface-2` | `oklch(0.21 0.013 258)`, `oklch(0.25 0.014 258)` | Paneles, lienzo, menús |
| Líneas | `line`, `line-strong` | `oklch(0.32 0.012 258)`, `oklch(0.54 0.014 258)` | Bordes y trazos del grafo |
| Tinta | `ink`, `ink-muted`, `ink-inverse` | `oklch(0.96 0.004 258)`, `oklch(0.74 0.012 258)`, `oklch(0.17 0.012 258)` | Texto (17:1 y 8.3:1) |
| **Ámbar** | `primary`, `primary-hover`, `primary-strong`, `primary-soft` | `oklch(0.82 0.16 72)` … | Progreso real: estrella encendida, barra de luz y el botón de encender |
| **Azul** | `accent`, `accent-soft` | `oklch(0.72 0.13 250)` | Lo accionable: estrella disponible, foco, selección, acciones primarias |
| Estrella apagada | `star-off` | `oklch(0.58 0.018 258)` | Estrella con prerrequisitos pendientes (4.5:1) |
| Estado | `danger`, `danger-soft`, `success` | — | Errores y confirmaciones destructivas |

Reglas que no se rompen:

1. **El ámbar solo lo emite el progreso real.** Cualquier otra acción primaria va en azul (`variant="accent"`). Si algo ámbar no representa progreso, está mal.
2. **En oscuro no hay sombras**: la elevación es luminancia + 1 px de borde. La única sombra es el halo ámbar del `glow`.
3. **El `glow` se reserva** a la estrella recién encendida y a la barra de luz.
4. El texto sobre ámbar o azul va en `ink-inverse` (carbón), que es lo legible.

`node web/scripts/check-contrast.mjs` verifica los 20 pares reales contra WCAG 2.2 AA leyendo los tokens del CSS. Sale ≠ 0 si alguno baja del mínimo.

## Typography

Una sola familia: **Geist** (sans) y **Geist Mono** para el código de los mini-retos. Escala fija en rem, ratio corto (registro product). `h1–h3` con `text-wrap: balance` y `letter-spacing: -0.02em`; prosa con `text-wrap: pretty` y ~70ch. **Cifras tabulares** en horas, pasos y contadores para que no bailen al actualizarse.

## La estrella (componente núcleo)

`web/src/components/ui/star.tsx`. El estado se distingue por **forma y color** (WCAG 1.4.1):

- **Completada:** disco ámbar con check en carbón. Sin borde: sobre carbón el ámbar ya es la luz.
- **Disponible:** aro azul con núcleo. Si es la *siguiente*, pulso suave (`star-pulse`).
- **Bloqueada:** aro punteado apagado.

## Constelación

`web/src/features/constellation/sky-map.tsx`. **SVG propio, sin librería de grafos.** Las líneas van en un `<svg>` de fondo y las estrellas son botones HTML posicionados encima: el título se corta con CSS y nunca lo pisa una línea, y cada estrella es un control nativo con teclado y `aria-label`.

- **Disposición determinista**: zigzag por filas (boustrofedón) según el orden de la ruta. Misma ruta ⇒ misma figura. El número de columnas sale del ancho medido (2 · 3 · 4 · 5).
- **Líneas rectas** de estrella a estrella, recortadas al borde del disco:
  - continua = prerrequisito; ámbar si el de origen está encendido, gris si no;
  - punteada = orden sugerido entre pasos consecutivos sin prerrequisito.
- **`mini`**: miniatura sin títulos ni interacción, para las tarjetas del cielo de rutas y la landing. `lines={false}` dibuja las estrellas sueltas (el estado previo a que exista la ruta).
- **Accesibilidad:** el lienzo interactivo es `role="group"` (contiene botones); la miniatura, `role="img"`. La lista «Pasos en orden» es la alternativa completa.

## Pantallas

- **Mapa de ruta** (`features/paths/path-view.tsx`): cabecera fina con **barra de luz** (un segmento por paso) y horas restantes; lienzo ancho; **riel de pasos** con el porqué de cada uno (sustituye a la lista que duplicaba el grafo); panel lateral con el porqué **primero**, datos después y la descripción colapsada. Encender lanza glow + aviso flotante que se va solo.
- **Cielo de rutas** (`features/paths/path-list.tsx`): la ruta que sigues va primera y a doble tamaño; las demás, en tarjetas con **su miniatura real**. Renombrar, archivar y eliminar viven en un menú `⋯` (`<details>` nativo), no compitiendo con el nombre.
- **Entrevista** (`features/assessment/`): una sola entrada con **selector de modo** (preguntas rápidas · simulacro), ambos con la misma dignidad. El progreso es una **línea de horizonte** que se llena.
- **Generación** (`features/paths/generation-view.tsx`): usa el mismo lienzo del mapa, así que la ruta se ve construirse y al terminar no hay salto visual.

## Motion (Motion 13, 150–500 ms, `ease-out` quint/expo, nada de rebotes)

- **Estrellas:** escala 0.6 → 1 con fade, escalonadas por posición.
- **Líneas:** se dibujan con `pathLength`.
- **Encendido:** escala y giro en el panel, glow 600 ms y aviso flotante.
- **Entrevista:** transición corta entre preguntas; el horizonte crece con cada respuesta.
- **`prefers-reduced-motion`:** sin trazos ni desplazamientos, solo fundidos o cambios instantáneos (regla global en `globals.css`).

## Components

- **`Button` / `ButtonLink`:** variantes `primary` (ámbar, solo encender), `accent` (azul, el resto de acciones primarias), `secondary`, `ghost`, `danger`; tamaños `sm`, `md`, `lg`; estados hover, focus, active, disabled y loading.
- **Formularios:** inputs nativos estilizados con `has-[:checked]`.
- **Confirmaciones inline** en lugar de modales.
- **Estados vacíos que enseñan**: el cielo vacío muestra una constelación apagada y la acción para trazar la primera.
- **Capas:** escala semántica en `:root` (`--z-dropdown` … `--z-toast`).

## Verificación

- `node web/scripts/check-contrast.mjs`: 20 pares en AA.
- **axe-core, WCAG 2.2 AA:** 0 violaciones en landing, cielo de rutas, mapa de ruta y en la entrevista (objetivo, área, autoevaluación y reto), con `reducedMotion: reduce`.
- **Sin scroll horizontal a 390 px** en las tres vistas de la app.
