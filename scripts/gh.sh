#!/usr/bin/env bash
# GitHub CLI del proyecto: el programa y su configuración viven en .venv (nada global).
# La sesión (token) queda en el llavero de macOS. Instalación: scripts/instalar-gh.sh
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
export GH_CONFIG_DIR="$RAIZ/.venv/gh"
if [ ! -x "$RAIZ/.venv/bin/gh" ]; then
  echo "Falta gh en .venv. Ejecuta: scripts/instalar-gh.sh" >&2
  exit 1
fi
exec "$RAIZ/.venv/bin/gh" "$@"
