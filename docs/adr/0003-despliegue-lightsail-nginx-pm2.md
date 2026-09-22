# ADR 0003: Desplegar en una instancia Lightsail con Nginx + PM2 y build en CI

- **Estado:** Aceptado
- **Fecha:** 2026-09-16
- **Capas afectadas:** infra / api / web / db

## Contexto

Ya se dispone de una instancia AWS Lightsail con PostgreSQL instalado y de los subdominios `constellation.waldirmaidana.com` (web) y `backend.constellation.waldirmaidana.com` (api). Hay un único desarrollador y 11 días; el despliegue debe ser reproducible, barato y no convertirse en un proyecto propio. Las instancias pequeñas se quedan sin memoria compilando Next.js.

## Decisión

- **DNS:** registros `A` de ambos subdominios hacia la IP estática de la instancia.
- **Nginx** como reverse proxy con un `server` por subdominio (`:3000` web, `:3001` api) y TLS con **certbot**. En la API: `proxy_buffering off` y `proxy_read_timeout` alto para SSE.
- **PM2** ejecuta `api` (`node dist/main.js`) y `web` (`node .next/standalone/server.js`) con `ecosystem.config.js` y arranque al reiniciar.
- **PostgreSQL** solo en `localhost`, usuario propio con permisos limitados a la BD `constellation`; 5432 cerrado en el firewall de Lightsail (abiertos: 22, 80, 443). `pg_dump` diario por cron.
- **GitHub Actions** en push a `main`: instala, testea y **compila en CI**, sube artefactos por `rsync`/SSH, ejecuta `migration:run` y `pm2 reload`.
- Secretos en `.env` de la instancia (fuera del repo) y en GitHub Secrets para el deploy.

## Alternativas descartadas

- **Docker Compose en la instancia** — más reproducible, pero añade consumo de memoria y tiempo de configuración que no se recupera en la ventana de la hackathon.
- **Vercel para la web + Lightsail para la API** — la cookie de sesión compartida exige que ambos cuelguen del mismo dominio (posible con dominio propio en Vercel), pero duplica plataformas y el streaming SSE queda repartido entre dos proxies.
- **Compilar en la instancia** — riesgo de OOM con Next.js en planes pequeños.

## Consecuencias

- Un único host a vigilar; el deploy es un workflow de CI versionado.
- Punto único de fallo aceptado para la escala de la hackathon.
- Gotchas derivados (cookie `Domain`, `trust proxy`, SSE en Nginx, `NEXT_PUBLIC_*` en build) documentados en `CLAUDE.md`.
