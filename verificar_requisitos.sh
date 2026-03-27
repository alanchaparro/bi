#!/usr/bin/env bash
# Comprueba requisitos. Opciones: --install  --quiet
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$DIR/scripts/check_prerequisites.sh" "$@"
