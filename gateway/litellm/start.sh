#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
VENV_DIR="$SCRIPT_DIR/.venv"
SECRET_FILE="$PROJECT_DIR/developer-data/litellm-secrets.local"
LOCAL_CONFIG_FILE="$PROJECT_DIR/developer-data/litellm-config.local.yaml"
CONFIG_FILE="$SCRIPT_DIR/config.yaml"

if [ ! -x "$VENV_DIR/bin/litellm" ]; then
  echo "LiteLLM 尚未安装，请先运行：npm run gateway:setup"
  exit 1
fi

if [ ! -f "$SECRET_FILE" ]; then
  echo "缺少本机网关密钥：$SECRET_FILE"
  exit 1
fi

chmod 600 "$SECRET_FILE"

set -a
. "$SECRET_FILE"
set +a

if [ -z "${LITELLM_MASTER_KEY:-}" ]; then
  echo "LITELLM_MASTER_KEY 不能为空。"
  exit 1
fi

if [ -f "$LOCAL_CONFIG_FILE" ]; then
  CONFIG_FILE="$LOCAL_CONFIG_FILE"
fi

echo "LiteLLM 网关：http://127.0.0.1:${LITELLM_PORT:-4000}"
exec "$VENV_DIR/bin/litellm" \
  --config "$CONFIG_FILE" \
  --host 127.0.0.1 \
  --port "${LITELLM_PORT:-4000}" \
  --reload
