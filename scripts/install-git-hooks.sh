#!/usr/bin/env sh
set -eu

if ! command -v git >/dev/null 2>&1; then
  echo "git no esta disponible en PATH." >&2
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

chmod +x githooks/pre-commit githooks/pre-push scripts/git-security-check.sh scripts/pre-push-safety.sh scripts/install-git-hooks.sh 2>/dev/null || true
git config core.hooksPath githooks
echo "Hooks Git instalados. hooksPath = githooks"
echo "Verificacion: git config --get core.hooksPath"
