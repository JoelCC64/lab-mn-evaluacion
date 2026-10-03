#!/usr/bin/env bash
# Descarga GitHub CLI (versión fija, release oficial de github.com/cli/cli) dentro de .venv,
# verificando su suma SHA-256. Solo hace falta para publicar en GitHub Pages.
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="2.102.0"
case "$(uname -m)" in
  arm64) ARQ="arm64" ;;
  x86_64) ARQ="amd64" ;;
  *) echo "Arquitectura no soportada: $(uname -m)" >&2; exit 1 ;;
esac
ZIP="gh_${VERSION}_macOS_${ARQ}.zip"
BASE="https://github.com/cli/cli/releases/download/v${VERSION}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL -o "$TMP/$ZIP" "$BASE/$ZIP"
curl -fsSL -o "$TMP/sumas.txt" "$BASE/gh_${VERSION}_checksums.txt"
esperado="$(grep " $ZIP\$" "$TMP/sumas.txt" | cut -d' ' -f1)"
real="$(shasum -a 256 "$TMP/$ZIP" | cut -d' ' -f1)"
if [ -z "$esperado" ] || [ "$esperado" != "$real" ]; then
  echo "La suma SHA-256 no coincide; no se instala." >&2
  exit 1
fi
unzip -q "$TMP/$ZIP" -d "$TMP"
install -m 755 "$TMP/gh_${VERSION}_macOS_${ARQ}/bin/gh" "$RAIZ/.venv/bin/gh"
"$RAIZ/.venv/bin/gh" --version | head -1
