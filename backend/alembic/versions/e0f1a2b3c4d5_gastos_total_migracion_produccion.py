"""Migración total módulo gastos para producción (idempotente)

Consolida los cambios de las migraciones:
  - a1b2c3d4e5f7: folio en paquetes_gastos + quitar unique user/semana
  - b2c3d4e5f6a8: tabla tokens_aprobacion_paquetes + check tipo comentario
  - c3d4e5f6a7b9: estado/devolucion individual en gastos_legalizacion
  - d4e5f6a7b8c0: monto_a_pagar en paquetes_gastos

Usa IF NOT EXISTS / DO $$ en todo para ser IDEMPOTENTE:
puede ejecutarse aunque algunas partes ya estén aplicadas.

Revision ID: e0f1a2b3c4d5
Revises: d4e5f6a7b8c0
Create Date: 2026-03-12
"""
from alembic import op
import sqlalchemy as sa

revision = 'e0f1a2b3c4d5'
down_revision = 'd4e5f6a7b8c0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # =========================================================================
    # 1. paquetes_gastos — quitar unique constraint user_id+semana (si existe)
    # =========================================================================
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'uq_paquete_user_semana'
            ) THEN
                ALTER TABLE paquetes_gastos DROP CONSTRAINT uq_paquete_user_semana;
            END IF;
        END $$;
    """)

    # =========================================================================
    # 2. paquetes_gastos — columna folio (con folios retroactivos)
    # =========================================================================
    op.execute("""
        ALTER TABLE paquetes_gastos ADD COLUMN IF NOT EXISTS folio VARCHAR(30);
    """)

    # Generar folios solo para filas que aún no los tienen
    op.execute("""
        WITH ranked AS (
            SELECT
                id,
                EXTRACT(YEAR FROM created_at)::int AS yr,
                ROW_NUMBER() OVER (
                    PARTITION BY EXTRACT(YEAR FROM created_at)::int
                    ORDER BY created_at ASC
                ) AS rn
            FROM paquetes_gastos
            WHERE folio IS NULL
        )
        UPDATE paquetes_gastos p
        SET folio = 'PKG-' || r.yr || '-' || LPAD(r.rn::text, 5, '0')
        FROM ranked r
        WHERE p.id = r.id;
    """)

    # NOT NULL + unique + index
    op.execute("""
        ALTER TABLE paquetes_gastos ALTER COLUMN folio SET NOT NULL;
    """)

    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'uq_paquete_folio'
            ) THEN
                ALTER TABLE paquetes_gastos ADD CONSTRAINT uq_paquete_folio UNIQUE (folio);
            END IF;
        END $$;
    """)

    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_paquetes_gastos_folio
        ON paquetes_gastos (folio);
    """)

    # =========================================================================
    # 3. paquetes_gastos — columna monto_a_pagar
    # =========================================================================
    op.execute("""
        ALTER TABLE paquetes_gastos ADD COLUMN IF NOT EXISTS monto_a_pagar NUMERIC(14, 2);
    """)

    # =========================================================================
    # 4. Tabla tokens_aprobacion_paquetes
    # =========================================================================
    op.execute("""
        CREATE TABLE IF NOT EXISTS tokens_aprobacion_paquetes (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            paquete_id  UUID NOT NULL REFERENCES paquetes_gastos(id) ON DELETE CASCADE,
            token       VARCHAR(128) NOT NULL UNIQUE,
            usado       BOOLEAN NOT NULL DEFAULT false,
            expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
            usado_at    TIMESTAMP WITH TIME ZONE,
            usado_por_ip VARCHAR(45),
            created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        );
    """)

    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_tokens_aprobacion_token
        ON tokens_aprobacion_paquetes (token);
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_tokens_aprobacion_paquete_id
        ON tokens_aprobacion_paquetes (paquete_id);
    """)

    # =========================================================================
    # 5. comentarios_paquete — actualizar check constraint para incluir
    #    'devolucion_gasto' en los tipos válidos
    # =========================================================================
    op.execute("""
        DO $$
        BEGIN
            -- Eliminar el constraint antiguo si existe (sin devolucion_gasto)
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'check_tipo_comentario_paquete_valid'
            ) THEN
                ALTER TABLE comentarios_paquete
                    DROP CONSTRAINT check_tipo_comentario_paquete_valid;
            END IF;

            -- Crear el constraint actualizado (idempotente: ya que lo borramos antes)
            ALTER TABLE comentarios_paquete
                ADD CONSTRAINT check_tipo_comentario_paquete_valid
                CHECK (tipo IN (
                    'observacion','devolucion','aprobacion',
                    'pago','envio_tesoreria','devolucion_gasto'
                ));
        END $$;
    """)

    # =========================================================================
    # 6. gastos_legalizacion — campos de devolución individual
    # =========================================================================
    op.execute("""
        ALTER TABLE gastos_legalizacion
            ADD COLUMN IF NOT EXISTS estado_gasto VARCHAR(20) NOT NULL DEFAULT 'pendiente';
    """)

    op.execute("""
        ALTER TABLE gastos_legalizacion
            ADD COLUMN IF NOT EXISTS motivo_devolucion_gasto TEXT;
    """)

    op.execute("""
        ALTER TABLE gastos_legalizacion
            ADD COLUMN IF NOT EXISTS devuelto_por_user_id UUID
            REFERENCES users(id) ON DELETE SET NULL;
    """)

    op.execute("""
        ALTER TABLE gastos_legalizacion
            ADD COLUMN IF NOT EXISTS fecha_devolucion_gasto TIMESTAMP WITH TIME ZONE;
    """)

    # Check constraint para estado_gasto
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'check_estado_gasto_valid'
            ) THEN
                ALTER TABLE gastos_legalizacion
                    ADD CONSTRAINT check_estado_gasto_valid
                    CHECK (estado_gasto IN ('pendiente','devuelto','aceptado'));
            END IF;
        END $$;
    """)

    # Foreign key para devuelto_por_user_id (si no existe ya)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_gastos_devuelto_por_user'
            ) THEN
                ALTER TABLE gastos_legalizacion
                    ADD CONSTRAINT fk_gastos_devuelto_por_user
                    FOREIGN KEY (devuelto_por_user_id)
                    REFERENCES users(id) ON DELETE SET NULL;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    # gastos_legalizacion
    op.execute("ALTER TABLE gastos_legalizacion DROP CONSTRAINT IF EXISTS check_estado_gasto_valid;")
    op.execute("ALTER TABLE gastos_legalizacion DROP CONSTRAINT IF EXISTS fk_gastos_devuelto_por_user;")
    op.execute("ALTER TABLE gastos_legalizacion DROP COLUMN IF EXISTS fecha_devolucion_gasto;")
    op.execute("ALTER TABLE gastos_legalizacion DROP COLUMN IF EXISTS devuelto_por_user_id;")
    op.execute("ALTER TABLE gastos_legalizacion DROP COLUMN IF EXISTS motivo_devolucion_gasto;")
    op.execute("ALTER TABLE gastos_legalizacion DROP COLUMN IF EXISTS estado_gasto;")

    # comentarios_paquete — revertir check constraint
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_tipo_comentario_paquete_valid') THEN
                ALTER TABLE comentarios_paquete DROP CONSTRAINT check_tipo_comentario_paquete_valid;
            END IF;
            ALTER TABLE comentarios_paquete ADD CONSTRAINT check_tipo_comentario_paquete_valid
                CHECK (tipo IN ('observacion','devolucion','aprobacion','pago','envio_tesoreria'));
        END $$;
    """)

    # tokens_aprobacion_paquetes
    op.execute("DROP INDEX IF EXISTS ix_tokens_aprobacion_paquete_id;")
    op.execute("DROP INDEX IF EXISTS ix_tokens_aprobacion_token;")
    op.execute("DROP TABLE IF EXISTS tokens_aprobacion_paquetes;")

    # paquetes_gastos
    op.execute("ALTER TABLE paquetes_gastos DROP COLUMN IF EXISTS monto_a_pagar;")
    op.execute("DROP INDEX IF EXISTS ix_paquetes_gastos_folio;")
    op.execute("ALTER TABLE paquetes_gastos DROP CONSTRAINT IF EXISTS uq_paquete_folio;")
    op.execute("ALTER TABLE paquetes_gastos DROP COLUMN IF EXISTS folio;")
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_paquete_user_semana') THEN
                ALTER TABLE paquetes_gastos ADD CONSTRAINT uq_paquete_user_semana UNIQUE (user_id, semana);
            END IF;
        END $$;
    """)
