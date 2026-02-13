import json
import sys
from pathlib import Path


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    backend_dir = repo_root / "backend"
    docs_dir = repo_root / "docs"
    output_file = docs_dir / "openapi-v1.json"

    sys.path.insert(0, str(backend_dir))

    from app.main import app  # noqa: E402

    docs_dir.mkdir(parents=True, exist_ok=True)
    schema = app.openapi()
    with output_file.open("w", encoding="utf-8") as f:
        json.dump(schema, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")

    print(f"OpenAPI exported: {output_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
