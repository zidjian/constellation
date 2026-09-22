# Despliegue — instancia Lightsail compartida

La instancia `34.200.218.45` (alias SSH `lightsail-backends`) también aloja otras apps: `waldirmaidana-backend` (:3001), `altaria-backend`, `qhaphiya-api` y un servicio en :3003. **No se toca nada que no sea de Constellation.**

| Pieza | Valor |
|---|---|
| Código en el servidor | `/home/ubuntu/constellation/{api,web,deploy}` |
| PM2 | `constellation-api` (:3011) y `constellation-web` (:3010), definidos en `ecosystem.config.js` |
| Nginx | `nginx/constellation.conf` y `nginx/backend.constellation.conf` → `/etc/nginx/sites-available/` + symlink en `sites-enabled/`; TLS con `certbot --nginx` |
| Secretos | `/home/ubuntu/constellation/api/.env` (lo carga la API). Nunca en el repo |
| BD | PostgreSQL 18 local; BD y rol `constellation` |
| Respaldo | `respaldo.sh` por cron a las 04:15 → `/home/ubuntu/respaldos/constellation-*.sql.gz`, 14 días de retención. Restaurar: `gunzip -c <archivo> \| psql "$DATABASE_URL"` |
| Arranque | `pm2 startup` (servicio `pm2-ubuntu`) restaura la lista de `pm2 save` al reiniciar. Cada deploy ejecuta `pm2 save` |
| DNS | Cloudflare con la nube **gris (DNS only)**. Con proxy, el certificado de Cloudflare no cubre `backend.constellation.` (dos niveles) y corta el SSE a los 100 s |

## Flujo

1. Push a `main` → `.github/workflows/deploy.yml` compila en CI, porque la instancia no tiene RAM para compilar Next.
2. `rsync` de `api/dist` + manifiestos, `web/.next/standalone` (con `public` y `.next/static` ya copiados) y `deploy/`.
3. `reload-constellation.sh` en el servidor: dependencias de producción de la API, migraciones, seed (cuando exista), `pm2 reload` y comprobación de `/v1/health`.

## Variables de producción (`/home/ubuntu/constellation/api/.env`)

Obligatorias (la API no arranca sin ellas). `reload-constellation.sh` las valida **antes** de migrar y recargar, y si falta alguna aborta con la versión anterior todavía en marcha.

| Variable | Valor en producción |
|---|---|
| `NODE_ENV` | `production` (activa `Secure` en las cookies y rechaza el `JWT_SECRET` de ejemplo) |
| `PORT` | `3011` |
| `DATABASE_URL` | `postgres://constellation:<pw>@127.0.0.1:5432/constellation` |
| `WEB_ORIGIN` | `https://constellation.waldirmaidana.com` (CORS y destino de los redirects) |
| `COOKIE_DOMAIN` | `.constellation.waldirmaidana.com`. **Si falta**, la cookie queda host-only de `backend.`, la web no la ve y el login "rebota" a `/` sin error |
| `JWT_SECRET` | `openssl rand -hex 32`, generado en el servidor |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | de la app de Discord |
| `DISCORD_CALLBACK_URL` | `https://backend.constellation.waldirmaidana.com/v1/auth/discord/callback`, registrada **exacta** en Discord → OAuth2 → Redirects |

Opcionales (IA, ADR-0001):

| Variable | Valor |
|---|---|
| `LLM_PROVIDER` | `claude` para activar Claude; sin ella, `rules` (la app funciona igual) |
| `ANTHROPIC_API_KEY` | Obligatoria si `LLM_PROVIDER=claude`. Nunca en el repo ni en logs |
| `ANTHROPIC_MODEL` | Por defecto `claude-opus-5` |
| `LLM_TIMEOUT_MS` | Por defecto `8000` (intérprete); al superarlo se usan reglas |
| `LLM_RATIONALE_TIMEOUT_MS` | Por defecto `25000` (redactor del porqué, corre en paralelo al stream) |

La web (PM2, `ecosystem.config.js`) recibe `API_INTERNAL_URL=http://127.0.0.1:3011`.

## Secretos de GitHub (environment `production`)

`DEPLOY_SSH_KEY` (clave privada de despliegue dedicada), `DEPLOY_KNOWN_HOSTS` (`ssh-keyscan 34.200.218.45`), `DEPLOY_HOST`, `DEPLOY_USER`.
