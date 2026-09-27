# Rediseño «Sala de control» — brief de diseño

> Estado: **propuesto**, pendiente de confirmación. Congela las decisiones de UX/UI del rediseño radical de `web/`.
> Si se aprueba y se implementa, `DESIGN.md` se reescribe al final para reflejar lo que quedó, y este documento pasa a histórico.

Fecha: 2026-09-26 · Entrega de Code Quest: **2026-09-28 10:00 GMT-6** · Registro: `product` (PRODUCT.md).

## 1. Qué es y para quién

Constellation deja de parecer una web de contenido con un grafo incrustado y pasa a ser **un tablero de misión**: una superficie oscura donde lo único que emite luz es el progreso real de la persona. La ruta —la constelación— deja de ser un recuadro lateral y se convierte en la pantalla principal del producto.

Sirve a las dos audiencias de PRODUCT.md: quien llega perdido entre 70 cursos y necesita saber **qué hago ahora**, y un jurado que en tres minutos tiene que ver que la ruta es real, ordenada y viva.

## 2. La acción primaria

En cada pantalla hay **una sola cosa** que la persona debe poder hacer sin pensar:

| Pantalla | Acción primaria |
|---|---|
| Landing | Entrar con Discord |
| Entrevista | Responder **esta** pregunta |
| Generación | Mirar cómo se dibuja su ruta |
| Mapa de ruta | Encender la estrella disponible |
| Cielo de rutas | Continuar por la ruta que ya empezó |

Todo lo demás es secundario y se ve secundario.

## 3. Diagnóstico de lo que hay hoy

Medido sobre capturas de las pantallas reales (1440 px y 390 px), no de memoria.

**Mapa de ruta** (`/paths/[id]`), la pantalla que más importa:
1. La constelación —lo que PRODUCT.md llama «el espectáculo»— ocupa un tercio del ancho y se dibuja pequeña dentro de un recuadro gris. Parece un visor de depuración.
2. Las etiquetas se **cortan y se pisan** con las líneas: «Vue.js: De cero a experto -…», «TypeScript: Guía Completa» encima de una arista.
3. **Redundancia**: el grafo y la lista «Pasos en orden» cuentan lo mismo. La lista es la que sirve; el grafo, el que luce. Compiten en vez de sumar.
4. **Tarjeta dentro de tarjeta** (el panel del curso dentro del layout de paneles): lo prohíbe el propio sistema de diseño.
5. **El progreso no se siente**: «0 de 4 estrellas encendidas» y cuatro aros de 10 px. No hay horas totales, ni restantes, ni ritmo.
6. **Jerarquía invertida**: el «por qué está en tu ruta» —nuestra ventaja real— es un recuadro gris de texto pequeño, y el bloque más largo de la pantalla es la descripción del curso, que es lo menos diferencial.
7. En móvil el grafo cae a modo compacto (bolitas numeradas) y pierde sentido; hay que bajar dos pantallas para llegar a los pasos.

**Cielo de rutas** (`/paths`): ocho filas idénticas con tres enlaces de texto repetidos —Renombrar · Archivar · Eliminar— con el mismo peso visual que el nombre de la ruta. «Eliminar» pesa lo mismo que «continuar». No se ve cuál seguir, ni cuánto llevas, ni qué forma tiene cada ruta. Es una tabla de administración.

**Entrevista** (`/assessment`): intro alineada a la izquierda con media pantalla vacía a la derecha. Dos llamadas compitiendo, y el simulacro —el diferencial— relegado a un botón fantasma bajo un divisor. No se anticipa el recorrido.

**Landing**: es lo más resuelto. Pero el hero vive en una caja con aire muerto a los lados, el diagrama es decorativo y «Cómo funciona» son tres columnas iguales, el patrón de tres tarjetas de siempre.

**Transversal**: todo el producto es blanco con el mismo ritmo vertical; nada distingue «estás en tu mapa» de «estás en una lista». Y el ámbar, que debería significar *encendido*, se gasta también en botones y etiquetas: cuando todo es ámbar, encender una estrella no significa nada.

## 4. Dirección visual

**Estrategia de color: Committed** (una superficie oscura carga el 100% del producto, el ámbar es el único color saturado y aparece poco).

**Escena:** son las once de la noche, la persona tiene el portátil en las rodillas, viene del Discord de DevTalles después de currar, y quiere ver su plan sin que la pantalla le queme la cara. Enciende una estrella y la habitación se ilumina un poco.

**Referencias ancla** (no adjetivos): el panel de una mesa de mezclas Allen & Heath a oscuras, donde solo brillan los canales activos; los mapas de metro nocturnos de Massimo Vignelli; el modo oscuro de Linear para la densidad y la disciplina de los estados.

**Explícitamente NO**: campo de estrellas, nebulosas, neón, degradados morados, glassmorphism. La anti-referencia de PRODUCT.md sigue vigente y el fondo oscuro no es una excusa para el cliché espacial. Carbón azulado plano, sin textura.

### La regla que da coherencia: la luz significa algo

1. **El ámbar solo lo emite el progreso real.** Una estrella encendida, la barra de luz, la celebración. Los botones primarios que *no* son «encender» pasan a azul de acción. El botón de encender una estrella es el único ámbar de la interfaz, y es ámbar porque enciende.
2. **El azul es lo que puedes hacer ahora**: la estrella disponible, el foco, la selección, las acciones.
3. **En oscuro no hay sombras**: la elevación se hace con luminancia y un borde de 1 px al 8% de blanco. Nada de `box-shadow` decorativo.
4. **El glow (`drop-shadow` ámbar) se reserva** a la estrella recién encendida, durante 600 ms. Es la recompensa, no un estilo.

### Tokens (OKLCH, reemplazan a los actuales en `globals.css`)

| Rol | Token | Valor | Contraste |
|---|---|---|---|
| Fondo | `bg` | `oklch(0.17 0.012 258)` | — |
| Superficies | `surface` / `surface-2` | `oklch(0.21 0.013 258)` / `oklch(0.25 0.014 258)` | — |
| Líneas | `line` / `line-strong` | `oklch(0.32 0.012 258)` / `oklch(0.42 0.012 258)` | — |
| Tinta | `ink` / `ink-muted` | `oklch(0.96 0.004 258)` / `oklch(0.74 0.012 258)` | ~15:1 / ~7:1 |
| Ámbar (encendido) | `primary` | `oklch(0.82 0.16 72)` | ~10:1 sobre `bg` |
| Azul (acción) | `accent` | `oklch(0.72 0.13 250)` | ~7:1 sobre `bg` |
| Estrella apagada | `star-off` | `oklch(0.45 0.015 258)` | 3.2:1 (gráfico) |
| Error | `danger` | `oklch(0.72 0.15 25)` | ~6:1 |

Sobre oscuro el ámbar **sí** funciona como texto (hoy hacía falta un `primary-strong` aparte para no romper AA sobre blanco): un token menos y una excepción menos que recordar.

**Tipografía:** sigue Geist, una sola familia (registro product). Cambia la escala: títulos de pantalla más grandes y con más aire, y **cifras tabulares** en horas, pasos y contadores para que no bailen al actualizarse. Mono solo para código.

## 5. Alcance

- **Fidelidad:** producción. Lo que se implemente se despliega.
- **Amplitud:** las seis superficies (landing, entrevista, simulacro, generación, mapa de ruta, cielo de rutas).
- **Interactividad:** componentes reales, verificados en navegador.
- **Tiempo:** cabe en la demo del 28. Cada fase se despliega por separado y el orden es de valor decreciente: si se acaba el tiempo, lo que quede fuera es lo menos visible.

## 6. Pantalla por pantalla

### 6.1 Mapa de ruta — la pantalla principal

**Cabecera fina** (no un bloque de título): nombre editable en línea · `2 de 5 encendidas` · `47 h restantes de 120 h`. Debajo, una **barra de luz**: una línea segmentada, un segmento por paso, que se enciende en ámbar. No es una barra de progreso genérica: es el recorrido.

**Lienzo a ancho completo**, 55–60 vh en escritorio, con SVG propio (fuera React Flow):

- trazo recto de estrella a estrella, continuo para prerrequisito y punteado para orden sugerido (se conserva la semántica actual, que es correcta);
- **calles reservadas para las etiquetas**: el layout en zigzag calcula la posición del texto antes de dibujar, con ancho fijo y dos líneas máximo. Ninguna etiqueta se corta ni se pisa con una línea. Este es el defecto más visible de hoy y se arregla de raíz;
- la estrella disponible late suave; la completada es un disco ámbar con check; la bloqueada, un aro punteado apagado. Estado por **forma y color**, nunca solo color;
- sin controles de zoom en escritorio (la ruta cabe: máximo 15 pasos). En móvil, desplazamiento horizontal con `scroll-snap` por paso.

**Riel de pasos** bajo el lienzo, en lugar de la lista duplicada: fichas horizontales con número, título, horas, estado y **una línea del porqué**. Seleccionar en el riel resalta la estrella y al revés. La lista ordenada completa sigue existiendo para lector de pantalla y en una vista «lista» conmutable, que además es la mejor vista en móvil.

**Panel de la estrella**: columna fija a la derecha del lienzo en escritorio (sin tarjeta dentro de tarjeta), hoja inferior arrastrable en móvil. Orden del contenido, invertido respecto a hoy:

1. **el porqué**, primero y en tamaño de lectura: es lo que nos diferencia;
2. nivel y duración, como datos compactos;
3. descripción del curso, colapsada («Ver descripción»);
4. **Encender esta estrella** (ámbar) y «Abrir en DevTalles» (enlace secundario).

**Al encender**: la estrella escala y emite glow 600 ms, el segmento correspondiente de la barra de luz se ilumina, y un aviso discreto dice `Estrella 2 encendida · quedan 3`. Con `prefers-reduced-motion`, cambio instantáneo sin glow.

**Estados**: recién creada (nada encendido, la primera estrella late), a medias, **completa** (toda la constelación encendida y una tarjeta de cierre con las horas totales invertidas), ruta de 15 pasos (el lienzo se reordena en más filas), nombre larguísimo, un solo paso.

### 6.2 Cielo de rutas

- Cada ruta es una **miniatura real de su propia constelación** (el mismo motor SVG en versión mini), no una fila de texto. Debajo: nombre, `3 de 5 encendidas`, `47 h restantes`.
- La ruta que sigues va **primera y a doble tamaño**, con «Continuar por aquí».
- Rejilla `repeat(auto-fit, minmax(280px, 1fr))`.
- Renombrar / Archivar / Eliminar se van a un menú `⋯` por tarjeta. Eliminar mantiene su confirmación en línea.
- Vacío que enseña: silueta punteada de una constelación y «Traza tu primera ruta».

### 6.3 Entrevista

- **Modo foco**: pantalla completa sin la navegación de la app, fondo carbón, una pregunta por vista en ancho de lectura.
- **Una sola entrada**, no dos botones compitiendo: «Empecemos» y debajo un selector de modo con dos opciones de igual dignidad — `Preguntas rápidas · 3 min` y `Simulacro con reclutador · 8 min` (esta última solo si el servidor la ofrece).
- **Progreso como horizonte**: una línea que se va llenando de izquierda a derecha y que, al terminar la entrevista, **se transforma en la primera línea de la constelación**. Es el puente visual entre entrevista y mapa.
- **Mini-retos**: código en mono sobre un panel más oscuro, opciones como filas grandes (objetivo táctil ≥ 44 px), respuesta inmediata al acertar o fallar, sin ruido.
- **Simulacro**: el chat funciona; pasa a oscuro con la burbuja del reclutador en `surface` y la tuya en azul tenue. Se conserva el indicador de escritura. El informe final gana la jerarquía que ya tiene bien.

### 6.4 Generación en streaming — el plano de la demo

Hoy es una pantalla intermedia que luego salta al mapa. Pasa a ser **el propio mapa construyéndose**: las estrellas aparecen una a una en el lienzo definitivo, la línea se dibuja entre ellas y el porqué se escribe bajo cada paso. Al terminar no hay salto de página: ya estás en tu ruta. Es el mejor plano de tres minutos para el jurado y quita una transición.

### 6.5 Landing

- Hero a sangre sobre carbón, con la constelación dibujándose una vez al cargar (visible aunque no anime).
- Fuera las tres columnas iguales: «Cómo funciona» pasa a ser **una secuencia de tres estados de la misma constelación** —entrevista, trazo, encendida— que cuenta el producto con la propia pieza en vez de con tres tarjetas.
- Se conserva lo que ya funciona: la promesa en dos líneas, «Entrar con Discord» y la nota de que es gratis.

## 7. Contenido y microcopia

- Cifras siempre concretas: `2 de 5 encendidas`, `47 h restantes`, `28,5 h` (decimal con coma, español).
- El porqué se muestra tal cual lo redacta la IA, sin recortar a dos líneas: es la prueba de que la ruta está razonada.
- Vacíos: «Traza tu primera ruta» (cielo), «Aún no encendiste ninguna estrella» (mapa nuevo).
- Errores: siempre con salida. «No pudimos generar la ruta. Vuelve a intentarlo o usa la entrevista guiada.»
- Nada de jerga en inglés cuando hay término en español (regla de PRODUCT.md).

## 8. Accesibilidad

- **WCAG 2.2 AA sobre el tema oscuro**, recalculando todos los pares (la tabla de tokens ya trae los objetivos).
- Foco visible en azul con desplazamiento de 2 px sobre cualquier superficie.
- Estado de cada estrella por forma además de color.
- La ruta tiene su **lista ordenada equivalente** y toda la interacción funciona con teclado.
- `prefers-reduced-motion`: sin trazos ni glow, solo fundidos o cambios instantáneos.
- Objetivo de verificación: **axe-core sin violaciones** en landing, entrevista (objetivo, autoevaluación, reto), simulacro, generación, cielo y mapa; y **sin scroll horizontal a 390 px**.

## 9. Plan de ejecución (cabe antes del 28)

Rama `feature/sala-de-control`. Cada fase se mergea y despliega por separado; el orden es de valor decreciente.

| Fase | Qué | Tiempo | Corte |
|---|---|---|---|
| 0 | Tokens nuevos, tipografía, script que verifica el contraste de todos los pares, capturas «antes» | 0,5 h | — |
| 1 | **Mapa de ruta**: lienzo SVG propio, etiquetas sin colisión, panel lateral, riel de pasos, barra de luz, encendido con glow | 3 h | Es el 70% del valor; si algo se cae, no es esto |
| 2 | **Cielo de rutas**: miniaturas reales, tarjeta «continuar», menú `⋯` | 1,5 h | Puede quedar fuera sin romper la demo |
| 3 | **Entrevista**: modo foco, entrada única con selector de modo, línea de horizonte, retos y chat en oscuro | 2 h | El modo foco es lo importante; el horizonte es prescindible |
| 4 | **Generación = mapa construyéndose** | 1 h | Si no entra, la pantalla actual sigue funcionando |
| 5 | **Landing** | 1 h | Lo último: es lo que mejor está hoy |
| 6 | **Verificación**: axe en 7 vistas, 390 px, `reduced-motion`, capturas nuevas del README, reescritura de `DESIGN.md` | 1 h | No se salta |

**Total ~10 h efectivas.** Regla de seguridad: a las 20:00 del 27 se congela; lo que esté verde se despliega y lo demás se queda en la rama. La versión actual sigue en `main` hasta que cada fase pasa su verificación.

## 10. Riesgos y anti-objetivos

- **Anti-objetivo 1:** que el fondo oscuro se convierta en el cliché espacial. Carbón plano, sin estrellitas de fondo, sin nebulosas.
- **Anti-objetivo 2:** que el ámbar se reparta por toda la interfaz. Si algo ámbar no representa progreso real, está mal.
- **Anti-objetivo 3:** un mapa bonito que no diga qué hacer ahora. La estrella disponible tiene que cantar en cualquier captura.
- **Riesgo:** quitar React Flow a dos días de la entrega. Se mitiga porque el layout ya es determinista (zigzag calculado por nosotros) y React Flow solo aportaba el lienzo y el `fitView`; lo que se gana es control de las etiquetas, menos peso y menos caja negra.
- **Riesgo:** rehacer contrastes en oscuro y romper AA. Se mitiga con el script de la fase 0 y axe en la fase 6.
