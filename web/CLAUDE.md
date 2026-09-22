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
- **`next-server` cambia el título del proceso:** `pkill -f server.js` no lo encuentra. Para pararlo en local, usa `lsof -tiTCP:3000 -sTCP:LISTEN | xargs kill`.
- **pnpm 11:** `sharp` y `unrs-resolver` quedan en `allowBuilds: false` (`pnpm-workspace.yaml`).
