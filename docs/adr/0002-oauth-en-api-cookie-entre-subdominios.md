# ADR 0002: OAuth de Discord en la API y sesión JWT en cookie compartida entre subdominios

- **Estado:** Aceptado
- **Fecha:** 2026-09-16
- **Capas afectadas:** api (identity) / web / infra

## Contexto

El login con Discord es obligatorio. Web y API viven en subdominios distintos del mismo sitio: `constellation.waldirmaidana.com` y `backend.constellation.waldirmaidana.com`. Next necesita conocer la sesión en `middleware.ts` y en Server Components (servidor), y la API en cada petición del navegador.

## Decisión

- La **API** ejecuta el flujo OAuth2 completo (`passport-discord`, `state` anti-CSRF), hace upsert del usuario y emite un **JWT propio** (7 días) en la cookie `cst_session`: `HttpOnly`, `Secure`, `SameSite=Lax`, `Domain=.constellation.waldirmaidana.com`.
- La **web** no maneja OAuth: redirige a `/v1/auth/discord`, lee la cookie en `middleware.ts` para proteger rutas y la reenvía cuando hace fetch desde el servidor.
- Los tokens de Discord se usan solo durante el callback y se descartan.

## Alternativas descartadas

- **Auth.js (NextAuth) en la web** — la sesión quedaría en Next y la API tendría que validar un token ajeno o duplicar lógica; dos fuentes de verdad de identidad.
- **JWT en `localStorage` + header `Authorization`** — expuesto a XSS y los Server Components no pueden leerlo.
- **Cookie host-only del subdominio de la API** — Next nunca la recibe; no se pueden proteger rutas en servidor.

## Consecuencias

- Identidad centralizada en el contexto `identity` de la API (coherente con DDD).
- Requiere CORS con `origin` explícito y `credentials: true`, `trust proxy` en Nest y un `Domain` distinto en local (sin `Domain`). Recogido en «Gotchas» de `CLAUDE.md`.
- `SameSite=Lax` basta porque ambos hosts son same-site; si algún día la web se sirve en otro dominio, este ADR debe superseder.

## Enmienda (2026-09-21)

La decisión se mantiene: OAuth en la API, JWT propio en una cookie compartida entre subdominios. Cambia la implementación: el flujo OAuth2 se hace a mano con `fetch`, **sin `passport-discord`**, porque su `state` requiere `express-session` y la librería no se mantiene. El `state` anti-CSRF viaja en la cookie `cst_oauth_state`. En la web, `middleware.ts` pasa a ser `proxy.ts` (Next 16). Detalle en «Arquitectura» y «Gotchas» de `CLAUDE.md`.
