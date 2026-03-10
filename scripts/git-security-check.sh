#!/usr/bin/env sh
set -eu

phase="${1:-pre-commit}"
case "$phase" in
  pre-commit|pre-push) ;;
  *)
    echo "Uso: $0 [pre-commit|pre-push]" >&2
    exit 2
    ;;
esac

if ! command -v git >/dev/null 2>&1; then
  echo "git no esta disponible en PATH." >&2
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

blocked_regex='(^|/)\.env$|(^|/)\.env\..+$|(^|/)secrets(/|$)|\.csv$|\.xlsx$|(^|/)analytics_meta\.json$|\.db$|(^|/)docs/archive/.+/evidence-old/.+$|\.pem$|\.key$|\.p12$|\.pfx$|\.jks$|\.keystore$|(^|/)id_rsa$|(^|/)id_ed25519$|(^|/)credentials\.json$'

tmp_all="$(mktemp)"
tmp_unique="$(mktemp)"
trap 'rm -f "$tmp_all" "$tmp_unique"' EXIT

git ls-files > "$tmp_all"
git diff --cached --name-only >> "$tmp_all"
sort -u "$tmp_all" > "$tmp_unique"

violations=""
while IFS= read -r file; do
  [ -n "$file" ] || continue
  [ "$file" = ".env.example" ] && continue
  if printf '%s\n' "$file" | grep -Eq "$blocked_regex"; then
    violations="${violations}${file}\n"
  fi
done < "$tmp_unique"

if [ -n "$violations" ]; then
  echo "[$phase] Se detectaron archivos sensibles/riesgosos en tracked o staged:" >&2
  printf '%b' "$violations" | while IFS= read -r item; do
    [ -n "$item" ] || continue
    echo " - $item" >&2
  done
  echo "" >&2
  echo "Accion sugerida:" >&2
  echo " - Remueva del commit o des-trackee: git rm --cached <archivo>" >&2
  exit 1
fi

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "[$phase] gitleaks no esta instalado. Bloqueando commit/push por politica de seguridad." >&2
  echo "Instalacion: https://github.com/gitleaks/gitleaks#installing" >&2
  exit 1
fi

if ! gitleaks detect --source . --no-git --redact --exit-code 1 --config .gitleaks.toml; then
  echo "[$phase] gitleaks detecto posibles secretos. Commit/push bloqueado." >&2
  exit 1
fi

echo "[$phase] Git security check OK."
