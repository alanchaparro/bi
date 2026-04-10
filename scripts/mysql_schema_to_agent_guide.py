#!/usr/bin/env python3
"""
Genera un markdown de guía de esquema MySQL (tablas, columnas, PK, FK) para asistentes/devs.

Uso (raíz del repo):
  python scripts/mysql_schema_to_agent_guide.py
  python scripts/mysql_schema_to_agent_guide.py --output docs/agents/mysql-epem-schema-agent-guide.md

Credenciales: solo MYSQL_* en .env (ver .env.example). No escribe secretos en el archivo generado.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from collections import defaultdict
from datetime import date

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)
os.chdir(_PROJECT_ROOT)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def _mysql_cfg() -> dict:
    return {
        "host": os.getenv("MYSQL_HOST", "localhost").strip(),
        "port": int(os.getenv("MYSQL_PORT", "3306")),
        "user": os.getenv("MYSQL_USER", "root").strip(),
        "password": os.getenv("MYSQL_PASSWORD", ""),
        "database": os.getenv("MYSQL_DATABASE", "epem").strip(),
        "ssl_disabled": os.getenv("MYSQL_SSL_DISABLED", "true").lower() in ("1", "true", "yes"),
        "connection_timeout": 30,
    }


def _esc(s: str | None) -> str:
    if s is None:
        return ""
    return (
        str(s)
        .replace("\\", "\\\\")
        .replace("|", "\\|")
        .replace("\n", " ")
    )


def _mermaid_id(table_name: str) -> str:
    """ID Mermaid seguro (letras, números, _; no inicia en dígito)."""
    s = re.sub(r"[^a-zA-Z0-9_]", "_", table_name) or "x"
    if s[0].isdigit():
        s = "t_" + s
    return s


def main() -> int:
    ap = argparse.ArgumentParser(description="MySQL schema → markdown guía para agentes")
    ap.add_argument(
        "--output",
        "-o",
        default=os.path.join("docs", "agents", "mysql-epem-schema-agent-guide.md"),
        help="Ruta del .md de salida",
    )
    ap.add_argument(
        "--max-mermaid-edges",
        type=int,
        default=280,
        metavar="N",
        help="Máximo de aristas en el diagrama Mermaid (0 = omitir diagrama)",
    )
    args = ap.parse_args()

    try:
        import mysql.connector
        from mysql.connector.errors import Error as MySQLError
    except ImportError:
        print("Instale dependencias: pip install mysql-connector-python python-dotenv", file=sys.stderr)
        return 1

    cfg = _mysql_cfg()
    if not cfg["host"] or not cfg["user"] or not cfg["database"]:
        print("Faltan MYSQL_HOST, MYSQL_USER o MYSQL_DATABASE en .env", file=sys.stderr)
        return 1

    schema = cfg["database"]
    try:
        conn = mysql.connector.connect(**cfg)
    except MySQLError as e:
        print(
            "No se pudo conectar a MySQL.\n"
            f"  host={cfg['host']!r} port={cfg['port']} user={cfg['user']!r} database={cfg['database']!r}\n"
            f"  error: {e}\n"
            "Configure MYSQL_HOST alcanzable (IP LAN, VPN) y credenciales en .env.\n"
            "Ejecute este script desde la misma red que el servidor MySQL.",
            file=sys.stderr,
        )
        return 1
    try:
        cur = conn.cursor(dictionary=True)

        cur.execute("SELECT VERSION() AS v")
        version = (cur.fetchone() or {}).get("v", "?")

        cur.execute(
            """
            SELECT TABLE_NAME, ENGINE, TABLE_ROWS, TABLE_COMMENT
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = %s AND TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
            """,
            (schema,),
        )
        tables = list(cur.fetchall())
        table_names = [t["TABLE_NAME"] for t in tables]

        cur.execute(
            """
            SELECT TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, COLUMN_TYPE, IS_NULLABLE,
                   COLUMN_KEY, COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = %s
            ORDER BY TABLE_NAME, ORDINAL_POSITION
            """,
            (schema,),
        )
        cols_by_table: dict[str, list] = defaultdict(list)
        for row in cur.fetchall():
            cols_by_table[row["TABLE_NAME"]].append(row)

        cur.execute(
            """
            SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = %s
              AND CONSTRAINT_NAME = 'PRIMARY'
            ORDER BY TABLE_NAME, ORDINAL_POSITION
            """,
            (schema,),
        )
        pk_by_table: dict[str, list[str]] = defaultdict(list)
        for row in cur.fetchall():
            pk_by_table[row["TABLE_NAME"]].append(row["COLUMN_NAME"])

        cur.execute(
            """
            SELECT
              k.CONSTRAINT_NAME,
              k.TABLE_NAME,
              k.COLUMN_NAME,
              k.ORDINAL_POSITION,
              k.REFERENCED_TABLE_NAME,
              k.REFERENCED_COLUMN_NAME,
              r.UPDATE_RULE,
              r.DELETE_RULE
            FROM information_schema.KEY_COLUMN_USAGE k
            INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS r
              ON r.CONSTRAINT_SCHEMA = k.TABLE_SCHEMA
             AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
            WHERE k.TABLE_SCHEMA = %s
              AND k.REFERENCED_TABLE_NAME IS NOT NULL
            ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION
            """,
            (schema,),
        )
        fk_rows = list(cur.fetchall())

        fk_outbound: dict[str, list[dict]] = defaultdict(list)
        fk_groups: dict[tuple[str, str], list[dict]] = defaultdict(list)
        for r in fk_rows:
            fk_outbound[r["TABLE_NAME"]].append(r)
            key = (r["TABLE_NAME"], r["CONSTRAINT_NAME"])
            fk_groups[key].append(r)

        inbound: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
        for r in fk_rows:
            rt = r["REFERENCED_TABLE_NAME"]
            inbound[rt].append((r["TABLE_NAME"], r["COLUMN_NAME"], r["CONSTRAINT_NAME"]))

        cur.close()
    finally:
        conn.close()

    out_dir = os.path.dirname(os.path.abspath(args.output))
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    lines: list[str] = []
    today = date.today().isoformat()

    lines.append(f"# Guía de esquema MySQL `{schema}` (para agentes y desarrollo)")
    lines.append("")
    lines.append("> **Generado automáticamente** — no editar a mano. Regenerar con `python scripts/mysql_schema_to_agent_guide.py`.")
    lines.append("")
    lines.append(f"- **Fecha:** {today}")
    lines.append(f"- **Motor:** MySQL `{_esc(version)}`")
    lines.append(f"- **Base:** `{schema}`")
    lines.append("- **Credenciales:** nunca en este archivo; usar `MYSQL_*` en `.env` local (ver `.env.example`).")
    lines.append("")
    lines.append("## Cómo usar esta guía (orden de precedencia)")
    lines.append("")
    lines.append("1. **`AGENTS.md`** — reglas de negocio y políticas del proyecto (cierre/gestión, tramos, exclusiones, etc.).")
    lines.append("2. **`docs/base.md`** — qué tablas entran en sync, JOINs alineados a `sql/v2/*`, inventario operativo.")
    lines.append("3. **Este documento** — catálogo **declarado** en MySQL (columnas, PK, FK). Útil para proponer JOINs coherentes con el motor; la **verdad operativa** del pipeline sigue siendo cada `query_*.sql` versionado.")
    lines.append("4. Si el esquema cambió en el servidor, regenerar este MD y, si aplica, actualizar `docs/base.md` y anexos bajo `archive-md-no-canonico/docs/archive/` (ver `scripts/dump_epem_fks.ps1`).")
    lines.append("")
    lines.append("## Resumen numérico")
    lines.append("")
    lines.append("| Métrica | Valor |")
    lines.append("|---------|------:|")
    lines.append(f"| Tablas (`BASE TABLE`) | {len(tables)} |")
    lines.append(f"| Restricciones FK (filas en `KEY_COLUMN_USAGE` con referencia) | {len(fk_rows)} |")
    lines.append(f"| Grupos de FK únicos (`TABLE` + `CONSTRAINT_NAME`) | {len(fk_groups)} |")
    lines.append("")

    # Hub tables by inbound FK count
    hub = sorted(inbound.items(), key=lambda x: len(x[1]), reverse=True)[:25]
    lines.append("## Tablas más referenciadas (grado entrante)")
    lines.append("")
    lines.append("Útil para ubicar **entidades pivote** (muchas tablas apuntan aquí).")
    lines.append("")
    lines.append("| Tabla referenciada | # referencias (columnas FK entrantes) |")
    lines.append("|--------------------|----------------------------------------:|")
    for ref_t, refs in hub:
        lines.append(f"| `{ref_t}` | {len(refs)} |")
    lines.append("")

    lines.append("## Grafo compacto de FK (Mermaid)")
    lines.append("")
    if args.max_mermaid_edges <= 0:
        lines.append("*(Diagrama omitido: `--max-mermaid-edges 0`.)*")
        lines.append("")
    else:
        lines.append(
            "Solo aristas **tabla → tabla** (sin columnas), para visión rápida. "
            "En esquemas muy grandes se trunca el número de aristas."
        )
        lines.append("")
        lines.append("```mermaid")
        lines.append("flowchart LR")
        seen_edges: set[tuple[str, str]] = set()
        added = 0
        for (tbl, cst), parts in sorted(fk_groups.items()):
            if added >= args.max_mermaid_edges:
                break
            ref_t = parts[0]["REFERENCED_TABLE_NAME"]
            edge = (tbl, ref_t)
            if edge in seen_edges:
                continue
            seen_edges.add(edge)
            id_a = _mermaid_id(tbl)
            id_b = _mermaid_id(ref_t)
            la = _esc(tbl).replace('"', "'")
            lb = _esc(ref_t).replace('"', "'")
            lines.append(f'  {id_a}["{la}"] --> {id_b}["{lb}"]')
            added += 1
        lines.append("```")
        all_pairs = {
            (tbl, plist[0]["REFERENCED_TABLE_NAME"])
            for (tbl, _cst), plist in fk_groups.items()
        }
        total_unique = len(all_pairs)
        if total_unique > len(seen_edges):
            lines.append("")
            lines.append(
                f"*Aristas mostradas en el diagrama: {len(seen_edges)} de {total_unique} únicas "
                f"(límite `--max-mermaid-edges {args.max_mermaid_edges}`). "
                "Aumente el límite o omita el diagrama con `--max-mermaid-edges 0`.*"
            )
        lines.append("")

    lines.append("## Catálogo por tabla")
    lines.append("")
    lines.append("Para cada tabla: motor/filas estimadas, PK, columnas, FK salientes y tablas que referencian esta.")
    lines.append("")

    for t in table_names:
        meta = next((x for x in tables if x["TABLE_NAME"] == t), {})
        engine = _esc(meta.get("ENGINE"))
        est_rows = meta.get("TABLE_ROWS")
        comment = _esc(meta.get("TABLE_COMMENT"))
        lines.append(f"### `{t}`")
        lines.append("")
        lines.append(f"- **Engine:** `{engine}`  ")
        lines.append(f"- **TABLE_ROWS (estimado):** `{est_rows}`  ")
        if comment:
            lines.append(f"- **Comentario tabla:** {comment}  ")
        lines.append("")

        pk = pk_by_table.get(t, [])
        if pk:
            lines.append(f"- **PK:** `{', '.join(pk)}`")
        else:
            lines.append("- **PK:** *(no declarada como `PRIMARY` en information_schema)*")
        lines.append("")

        inc = inbound.get(t, [])
        if inc:
            lines.append("**Referenciada por (muestra):**")
            uniq = sorted({(a, c) for a, _, c in inc})
            for child, cst in uniq[:40]:
                lines.append(f"- `{child}` → `{t}` (`{cst}`)")
            if len(uniq) > 40:
                lines.append(f"- *… y {len(uniq) - 40} restricciones más*")
            lines.append("")

        # Outbound FK grouped
        by_cst: dict[str, list] = defaultdict(list)
        for r in fk_outbound.get(t, []):
            by_cst[r["CONSTRAINT_NAME"]].append(r)
        if by_cst:
            lines.append("**FK salientes:**")
            lines.append("")
            for cst in sorted(by_cst.keys()):
                parts = sorted(by_cst[cst], key=lambda x: x["ORDINAL_POSITION"])
                ref_table = parts[0]["REFERENCED_TABLE_NAME"]
                u_rule = parts[0].get("UPDATE_RULE", "")
                d_rule = parts[0].get("DELETE_RULE", "")
                cols = [p["COLUMN_NAME"] for p in parts]
                rcols = [p["REFERENCED_COLUMN_NAME"] for p in parts]
                lines.append(
                    f"- `{cst}`: (`{', '.join(cols)}`) → `{ref_table}` (`{', '.join(rcols)}`) "
                    f"ON UPDATE {u_rule} / ON DELETE {d_rule}"
                )
            lines.append("")

        lines.append("| Columna | Tipo | Null | Key | Default | Extra | Comentario |")
        lines.append("|---------|------|------|-----|---------|-------|------------|")
        for c in cols_by_table.get(t, []):
            dfl = c.get("COLUMN_DEFAULT")
            if dfl is not None and len(str(dfl)) > 48:
                dfl = str(dfl)[:45] + "..."
            lines.append(
                "| `{col}` | `{typ}` | {null} | `{key}` | {dfl} | `{ex}` | {com} |".format(
                    col=_esc(c["COLUMN_NAME"]),
                    typ=_esc(c["COLUMN_TYPE"]),
                    null=_esc(c["IS_NULLABLE"]),
                    key=_esc(c["COLUMN_KEY"] or ""),
                    dfl=_esc(dfl) if dfl is not None else "NULL",
                    ex=_esc(c["EXTRA"] or ""),
                    com=_esc(c.get("COLUMN_COMMENT") or ""),
                )
            )
        lines.append("")

    with open(args.output, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))

    print(f"OK: {args.output} ({len(tables)} tablas)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
