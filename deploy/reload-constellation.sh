#!/bin/bash
# Se ejecuta en el servidor tras copiar los artefactos de CI (ver .github/workflows/deploy.yml).
set -euo pipefail

ROOT=/home/ubuntu/constellation

echo "==> API: dependencias de producción"
cd "$ROOT/api"
pnpm install --frozen-lockfile --prod

echo "==> API: validar variables de entorno (antes de tocar nada)"
# Si falta una variable, la API no arrancaría: se aborta aquí, con la versión anterior todavía en marcha.
node -e "require('./dist/shared/infrastructure/config/env').loadDotEnv(); require('./dist/shared/infrastructure/config/env').loadEnv()"

echo "==> API: migraciones"
pnpm migration:run:prod

if [ -f dist/catalog/infrastructure/seed/seed.js ]; then
  echo "==> API: seed del catálogo (idempotente)"
  pnpm seed:prod
fi

echo "==> PM2"
cd "$ROOT"
for app in constellation-api constellation-web; do
  if pm2 describe "$app" > /dev/null 2>&1; then
    pm2 reload deploy/ecosystem.config.js --only "$app" --env production --update-env
  else
    pm2 start deploy/ecosystem.config.js --only "$app" --env production
  fi
done
pm2 save

echo "==> Health"
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3011/v1/health > /dev/null; then
    curl -fsS http://127.0.0.1:3011/v1/health; echo
    curl -fsS -o /dev/null -w "web %{http_code}\n" http://127.0.0.1:3010/
    exit 0
  fi
  sleep 1
done
echo "La API no respondió a /v1/health" >&2
exit 1
