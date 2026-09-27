#!/bin/bash
# Escribe (o actualiza) una variable en el .env de la API, leyendo el valor de la entrada estándar.
#
# El valor no viaja como argumento a propósito: los argumentos se ven en `ps` de cualquier usuario
# del servidor, que es compartido. El .env no se copia en el rsync (--exclude .env), así que esta
# es la vía para que un secreto de GitHub llegue al servidor.
#
#   printf '%s' "$RESEND_API_KEY" | bash deploy/set-env-var.sh RESEND_API_KEY
set -euo pipefail

NOMBRE="${1:?Falta el nombre de la variable}"
ENV_FILE=/home/ubuntu/constellation/api/.env

if [[ ! "$NOMBRE" =~ ^[A-Z][A-Z0-9_]*$ ]]; then
  echo "Nombre de variable no válido: $NOMBRE" >&2
  exit 1
fi

VALOR="$(cat)"
if [ -z "$VALOR" ]; then
  echo "==> $NOMBRE sin valor: se deja el .env como está"
  exit 0
fi

touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

# Se compara sin imprimir el valor: el log del deploy es público en el repo.
if grep -qxF "$NOMBRE=$VALOR" "$ENV_FILE"; then
  echo "==> $NOMBRE ya estaba al día"
  exit 0
fi

TMP="$(mktemp)"
chmod 600 "$TMP"
grep -v "^$NOMBRE=" "$ENV_FILE" > "$TMP" || true
printf '%s=%s\n' "$NOMBRE" "$VALOR" >> "$TMP"
mv "$TMP" "$ENV_FILE"
chmod 600 "$ENV_FILE"
echo "==> $NOMBRE actualizada"
