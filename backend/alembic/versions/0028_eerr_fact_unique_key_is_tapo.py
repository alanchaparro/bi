"""eerr_fact: agregar is_tapo a unique key para permitir filas TAPO y no-TAPO por cuenta

Revision ID: 0028_eerr_fact_unique_key_is_tapo
Revises: 0027_eerr_fact_is_tapo
Create Date: 2025-01-09

Sin este cambio, el upsert ON CONFLICT usaba la clave
(gestion_month, social_reason_id, accounting_plan_id, eerr_block)
sin distinguir is_tapo, lo que causaba que la fila is_tapo=0
fuera sobrescrita por is_tapo=1 (o viceversa).  El resultado era que
el filtro "Sin TAPO" eliminaba cuentas enteras en vez de solo la
porción financiada.

Ahora la clave única incluye is_tapo, permitiendo que coexistan
filas con is_tapo=0 (no-TAPO) e is_tapo=1 (TAPO) para la misma
cuenta, mes y razón social.
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "0028_eerr_fact_unique_key_is_tapo"
down_revision = "0027_eerr_fact_is_tapo"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Eliminar la constraint única anterior (sin is_tapo)
    op.drop_index("ux_eerr_fact_business_key", table_name="eerr_fact")

    # 2. Eliminar filas duplicadas potenciales antes de crear la nueva constraint.
    #    Con la clave vieja solo existía una fila por (gestion_month, social_reason_id,
    #    accounting_plan_id, eerr_block); al agregar is_tapo pueden coexistir dos filas
    #    con is_tapo=0 e is_tapo=1.  Antes de crear la constraint, borramos todo el
    #    contenido de eerr_fact para que el siguiente sync re-pueble con la nueva
    #    estructura (GROUP BY separa TAPO/no-TAPO).
    op.execute("TRUNCATE TABLE eerr_fact")

    # 3. Eliminar también los agregados mensuales (dependen de eerr_fact y serán
    #    recalculados por el siguiente sync).
    op.execute("TRUNCATE TABLE eerr_monthly_agg")

    # 4. Crear la nueva constraint única incluyendo is_tapo
    op.create_index(
        "ux_eerr_fact_business_key",
        "eerr_fact",
        [
            "gestion_month",
            "social_reason_id",
            "accounting_plan_id",
            "eerr_block",
            "is_tapo",
        ],
        unique=True,
    )


def downgrade():
    # 1. Eliminar la constraint única con is_tapo
    op.drop_index("ux_eerr_fact_business_key", table_name="eerr_fact")

    # 2. Restaurar la constraint única original (sin is_tapo)
    op.create_index(
        "ux_eerr_fact_business_key",
        "eerr_fact",
        [
            "gestion_month",
            "social_reason_id",
            "accounting_plan_id",
            "eerr_block",
        ],
        unique=True,
    )
