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

## Secretos de GitHub (environment `production`)

`DEPLOY_SSH_KEY` (clave privada de despliegue dedicada), `DEPLOY_KNOWN_HOSTS` (`ssh-keyscan 34.200.218.45`), `DEPLOY_HOST`, `DEPLOY_USER`.
