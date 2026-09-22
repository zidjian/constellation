#!/usr/bin/env bash
# Respaldo diario de la BD de Constellation, con rotación. Mismo esquema que el de baseline.
# La BD vive en la misma instancia que la app: un disco, un punto de fallo.
#
# Cron (servidor):  15 4 * * * /home/ubuntu/constellation/deploy/respaldo.sh >> /home/ubuntu/respaldos/respaldo.log 2>&1
set -euo pipefail

DESTINO="${CONSTELLATION_RESPALDOS:-/home/ubuntu/respaldos}"
DIAS_A_GUARDAR="${CONSTELLATION_RETENCION_DIAS:-14}"
ENV_FILE="${CONSTELLATION_ENV:-/home/ubuntu/constellation/api/.env}"

# La credencial sale del .env de la API: no se duplica en ningún otro sitio.
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2-)"
[ -n "$DATABASE_URL" ] || { echo "FALLO: sin DATABASE_URL en $ENV_FILE" >&2; exit 1; }

mkdir -p "$DESTINO"
FICHERO="$DESTINO/constellation-$(date +%F-%H%M).sql.gz"

# --clean --if-exists: restaurable sobre una BD que ya tenga tablas.
pg_dump --clean --if-exists --no-owner "$DATABASE_URL" | gzip > "$FICHERO"

# Un volcado vacío es peor que ninguno: parece que hay respaldo.
if [ ! -s "$FICHERO" ] || [ "$(gzip -dc "$FICHERO" | wc -c)" -lt 100 ]; then
  echo "FALLO: el volcado salió vacío, lo borro" >&2
  rm -f "$FICHERO"
  exit 1
fi

find "$DESTINO" -name 'constellation-*.sql.gz' -mtime "+$DIAS_A_GUARDAR" -delete
echo "OK  $FICHERO  ($(du -h "$FICHERO" | cut -f1))"
