#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
SECRET_FILE="$PROJECT_DIR/developer-data/litellm-secrets.local"

if [ ! -f "$SECRET_FILE" ]; then
  echo "缺少本机网关密钥：$SECRET_FILE"
  exit 1
fi

set -a
. "$SECRET_FILE"
set +a

curl --fail --silent --show-error \
  --header "Authorization: Bearer $LITELLM_MASTER_KEY" \
  "http://127.0.0.1:${LITELLM_PORT:-4000}/v1/models"
printf '\n'
