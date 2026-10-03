#!/usr/bin/env bash
# Crea (o repara) el entorno aislado del proyecto. No instala nada de forma global:
#   - .venv con Python (uv) y las herramientas de pyproject.toml (nodeenv, openpyxl)
#   - Node, en la versión de .node-version, dentro de ese mismo .venv (nodeenv)
#   - dependencias de npm en ./node_modules
set -euo pipefail
cd "$(dirname "$0")/.."

NODE_VERSION="$(cat .node-version)"

uv sync

if [ ! -x .venv/bin/node ] || [ "$(.venv/bin/node --version)" != "v${NODE_VERSION}" ]; then
  VIRTUAL_ENV="$PWD/.venv" .venv/bin/nodeenv --python-virtualenv --node="${NODE_VERSION}" --prebuilt --force
fi

# shellcheck disable=SC1091
source .venv/bin/activate
if [ -f package-lock.json ]; then npm ci; else npm install; fi

echo
echo "Entorno listo. Para usarlo:  source .venv/bin/activate"
