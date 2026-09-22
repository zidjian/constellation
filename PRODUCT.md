# Product

## Register

product

## Users

Estudiantes actuales o potenciales de DevTalles, casi siempre hispanohablantes de Latinoamérica: desde quien nunca programó hasta devs con experiencia que quieren cambiar de stack o conseguir un puesto concreto (a veces con la oferta de trabajo en la mano). Entran desde el Discord de la comunidad y lo abren sobre todo en portátil, pero también en el móvil.

Tienen un problema de orientación. El catálogo tiene más de 70 cursos y no saben por dónde empezar ni en qué orden seguir. Lo que necesitan es salir con un plan concreto que puedan seguir y volver a él a marcar su avance.

Audiencia secundaria: el jurado de la hackathon Code Quest 2026 (DevTalles), que evalúa en una demo en vivo de pocos minutos.

## Product Purpose

Constellation convierte una entrevista corta (preguntas y mini-retos de código) en una **ruta de aprendizaje personal** sobre el catálogo real de DevTalles. La ruta se presenta como una constelación: cada curso es una estrella y las líneas son sus prerrequisitos. El usuario puede guardar varias rutas y encender las estrellas a medida que completa los cursos.

Hay éxito cuando la persona:
1. termina la entrevista sin abandonarla;
2. entiende en segundos por qué cada curso está en su ruta y en ese orden;
3. vuelve a marcar progreso.

Para el jurado, hay éxito si en la demo se ve de inmediato que la ruta es dinámica, correcta y real: nunca inventa cursos y respeta los prerrequisitos.

## Brand Personality

**Aventura gamificada.** Tres palabras: *enérgica, lúdica, merecida*.

- El avance se **siente**: responder un reto, generar la ruta y completar un curso son momentos con respuesta visible (estrellas que se encienden, trazos que se dibujan, una pequeña celebración).
- El tono es cercano y en español neutro latinoamericano, con tuteo. Anima sin sermonear y celebra sin exagerar. Los errores se dicen claro y con salida ("no pudimos…, prueba…").
- La emoción objetivo es "quiero ver cómo se enciende la siguiente". Es progreso con recompensa, no obligación ni deberes.

## Anti-references

- **El espacio cliché.** Fondo negro con campo de estrellas, nebulosas moradas, neón, planetas, cohetes. "Constelación" es la metáfora de estructura (puntos conectados que forman una figura con sentido), no una licencia para un wallpaper espacial. La idea tiene que funcionar sin ese decorado.
- Por extensión, también se evitan los reflejos de la gamificación genérica: mascotas, confeti en cada clic, insignias de colores sin significado y sonidos. Cada celebración corresponde a un progreso real.

## Design Principles

1. **Lo que se celebra es real.** Las recompensas visuales solo aparecen ante progreso verdadero: un reto acertado, una ruta generada, un curso completado. Nada se enciende por decoración.
2. **Un paso a la vez.** La entrevista muestra una pregunta por pantalla con foco total. La constelación destaca la siguiente estrella disponible: siempre queda claro qué hacer ahora.
3. **La verdad del catálogo, a la vista.** Cursos, duraciones y enlaces reales de DevTalles. El "por qué" de cada paso es visible junto al curso, no escondido. La confianza viene de mostrar el razonamiento.
4. **La estructura es el espectáculo.** La constelación es la pieza memorable porque dibuja el grafo real de prerrequisitos. La belleza sale de la forma de la ruta, no de ornamentos.
5. **Rápido y sin depender de nada.** Funciona igual sin IA, carga rápido y la generación se ve crecer en vivo. La demo nunca espera.

## Accessibility & Inclusion

- **WCAG 2.2 AA.** Contraste AA en texto e iconos, foco visible y orden de tabulación lógico.
- **Teclado:** toda la entrevista, la constelación (navegar entre estrellas y marcar completado) y la gestión de rutas funcionan sin ratón.
- **Constelación accesible:** tiene una representación equivalente en lista ordenada para lectores de pantalla, y el estado de cada curso (completado, disponible, con prerrequisitos pendientes) no depende solo del color.
- **Movimiento:** `prefers-reduced-motion` respetado. Las celebraciones y los trazos pasan a transiciones mínimas o instantáneas.
- **Idioma:** español, `lang="es"`. Nada de jerga en inglés cuando existe un término claro en español.
