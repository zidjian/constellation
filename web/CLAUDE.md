@AGENTS.md

# web/ — gotchas locales

Lee primero el `CLAUDE.md` raíz. Aquí solo lo específico de la web.

- **Next.js 16:** `middleware.ts` se renombró a **`proxy.ts`**, que exporta `proxy` y va en `src/`. Antes de usar una API de Next, consulta la guía local en `node_modules/next/dist/docs/` (ver `AGENTS.md`, que regenera `next dev`).
- **`output: 'standalone'` no copia los estáticos.** Después de `pnpm build` hay que ejecutar `cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/`. Si no, `server.js` sirve la página sin CSS ni JS. `public/` existe siempre (tiene un `.gitkeep`) para que el primer `cp` no falle.
- **`NEXT_PUBLIC_API_URL` es obligatoria en el build de producción:** `src/lib/api.ts` lanza un error si falta, para no apuntar a localhost sin avisar.
- **`NEXT_PUBLIC_API_URL` se incrusta en build time.** En local va en `.env.local`, copiado de `.env.example`. En producción se define en el build de CI.
- **`API_INTERNAL_URL` (runtime, solo servidor):** `api.server.ts` la usa para llamar a la API por `127.0.0.1:3011` en producción. Sin ella usa `NEXT_PUBLIC_API_URL`. En local no hace falta.
- **Cliente API:** `src/lib/api.ts` es para el navegador (`credentials: 'include'`). `src/lib/api.server.ts` es para Server Components (reenvía la cookie `cst_session`) y es `server-only`. Ambos devuelven `data` o lanzan `ApiError` con `code`.
- **Streaming:** `src/lib/sse.ts` (`readSse`) lee SSE desde `fetch`. Si la respuesta no es `text/event-stream` (401, 429…), lanza `ApiError`; si se aborta, lanza `AbortError`. `EventSource` no se usa porque solo hace GET.
- **Auth en la web:** `src/proxy.ts` solo mira si existe la cookie `cst_session` en `/assessment` y `/paths`. El layout de `src/app/(app)/` valida la sesión contra `/v1/me` (`getCurrentUser`) y redirige a `/` si da 401. El login es un enlace (navegación completa) a `API/v1/auth/discord`, nunca un `fetch`.
- **Errores de la API en rutas protegidas:** el layout de `(app)` captura los fallos que no son 401 (API caída o timeout de 5 s en `serverApiFetch`) y responde desde el servidor. Un `error.tsx` no sirve para esto: no captura los errores del layout de su mismo segmento y, en producción, solo se pinta en el cliente.
- **`next-server` cambia el título del proceso:** `pkill -f server.js` no lo encuentra. Para pararlo en local, usa `lsof -tiTCP:3000 -sTCP:LISTEN | xargs kill`.
- **Tokens en `@theme` (Tailwind 4):** `globals.css` define colores, radios y easings como tokens, y generan utilidades (`bg-primary`, `rounded-md`, `ease-out-quint`). La sintaxis `[--var]` de Tailwind 3 ya no funciona: usa el token directo o `(--var)`.
- **React Flow:** `data` de los nodos debe ser `type` (no `interface`) para encajar en `Record<string, unknown>`. El grafo se monta **después** de medir el contenedor (`Measured` en `constellation.tsx`); si se monta antes, el `fitView` inicial encuadra una rejilla que luego cambia y la figura queda diminuta.
- **Grid con React Flow dentro:** el hijo del grid necesita `min-w-0`, o el lienzo empuja el ancho y aparece scroll horizontal en móvil.
- **Generación en la web:** `GenerationView` aborta el stream al desmontarse. En dev, StrictMode monta dos veces: la primera generación se corta (la API no la guarda) y la segunda llega a `done`. Cada montaje cuenta para el rate limit de 5/h.
- **Verificación visual:** Chrome local en headless con `playwright-core` (sin descargar navegadores): `executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'`. La sesión se inyecta como cookie `cst_session` con un JWT firmado con el `JWT_SECRET` local.
- **Simulacro de entrevista:** `/assessment` lo ofrece solo si `GET /v1/assessments/modes` dice `recruiter: true` (depende de la IA del servidor). El chat vive en `features/assessment/recruiter-flow.tsx`; `Summary` está en su propio archivo porque lo comparten los dos modos (importarlo desde `assessment-flow` creaba un ciclo). El contador de turnos se calcula con los mensajes, no con `answeredCount`: en el simulacro esa cuenta incluye lo que dedujo el reclutador.
- **pnpm 11:** `sharp` y `unrs-resolver` quedan en `allowBuilds: false` (`pnpm-workspace.yaml`).
