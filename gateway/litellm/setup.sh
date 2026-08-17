#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
VENV_DIR="$SCRIPT_DIR/.venv"
REQUIREMENTS_FILE="$SCRIPT_DIR/requirements.txt"

supports_litellm() {
  "$1" -c 'import sys; raise SystemExit(0 if (3, 10) <= sys.version_info < (3, 15) else 1)' >/dev/null 2>&1
}

find_python() {
  if [ -n "${LITELLM_PYTHON:-}" ] && supports_litellm "$LITELLM_PYTHON"; then
    printf '%s\n' "$LITELLM_PYTHON"
    return 0
  fi

  for candidate in python3.14 python3.13 python3.12 python3.11 python3.10 python3; do
    if command -v "$candidate" >/dev/null 2>&1 && supports_litellm "$candidate"; then
      command -v "$candidate"
      return 0
    fi
  done

  bundled_python="/Users/prom2/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
  if [ -x "$bundled_python" ] && supports_litellm "$bundled_python"; then
    printf '%s\n' "$bundled_python"
    return 0
  fi

  return 1
}

PYTHON_BIN=$(find_python || true)
if [ -z "$PYTHON_BIN" ]; then
  echo "LiteLLM 需要 Python 3.10～3.14。当前没有找到兼容版本。"
  echo "安装兼容 Python 后再次运行：npm run gateway:setup"
  exit 1
fi

if [ ! -x "$VENV_DIR/bin/python" ]; then
  echo "正在创建 LiteLLM 独立运行环境……"
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

echo "正在安装固定版本的 LiteLLM……"
"$VENV_DIR/bin/python" -m pip install --disable-pip-version-check -r "$REQUIREMENTS_FILE"
echo "LiteLLM 已安装：$("$VENV_DIR/bin/python" -c 'from importlib.metadata import version; print(version("litellm"))')"
