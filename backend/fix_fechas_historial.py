"""
Backfill fecha_envio_contabilidad y fecha_envio_tesoreria usando el historial
de factura_asignaciones. Para cada factura con campo NULL, busca cuándo fue
asignada a esa área y usa ese created_at como fecha.
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os

DB = os.environ.get("DATABASE_URL", "postgresql+asyncpg://postgres:Samuel22.@localhost:5432/contabilidadcq")

CONTABILIDAD_ID = '725f5e5a-49d3-4e44-800f-f5ff21e187ac'
TESORERIA_ID    = 'b067adcd-13ff-420f-9389-42bfaa78cf9f'

async def fix():
    engine = create_async_engine(DB)
    async with engine.connect() as conn:

        # 1. fecha_envio_contabilidad: todas las facturas con NULL que alguna vez
        #    pasaron por Contabilidad (según factura_asignaciones)
        r1 = await conn.execute(text(f"""
            UPDATE facturas f
            SET fecha_envio_contabilidad = (
                SELECT MIN(fa.created_at)
                FROM factura_asignaciones fa
                WHERE fa.factura_id = f.id
                  AND fa.area_id = '{CONTABILIDAD_ID}'
            )
            WHERE f.fecha_envio_contabilidad IS NULL
              AND EXISTS (
                  SELECT 1 FROM factura_asignaciones fa
                  WHERE fa.factura_id = f.id
                    AND fa.area_id = '{CONTABILIDAD_ID}'
              )
            RETURNING f.numero_factura
        """))
        filas1 = r1.fetchall()

        # 2. fecha_envio_tesoreria: todas con NULL que pasaron por Tesorería
        r2 = await conn.execute(text(f"""
            UPDATE facturas f
            SET fecha_envio_tesoreria = (
                SELECT MIN(fa.created_at)
                FROM factura_asignaciones fa
                WHERE fa.factura_id = f.id
                  AND fa.area_id = '{TESORERIA_ID}'
            )
            WHERE f.fecha_envio_tesoreria IS NULL
              AND EXISTS (
                  SELECT 1 FROM factura_asignaciones fa
                  WHERE fa.factura_id = f.id
                    AND fa.area_id = '{TESORERIA_ID}'
              )
            RETURNING f.numero_factura
        """))
        filas2 = r2.fetchall()

        # 3. fecha_cierre: facturas en estado Pagada (estado_id=5) con NULL
        #    Usar updated_at como proxy (es cuando se marcó como pagada)
        r3 = await conn.execute(text("""
            UPDATE facturas f
            SET fecha_cierre = COALESCE(f.updated_at, NOW())
            WHERE f.fecha_cierre IS NULL
              AND f.estado_id = 5
            RETURNING f.numero_factura
        """))
        filas3 = r3.fetchall()

        await conn.commit()
        print(f"fecha_envio_contabilidad actualizada en {len(filas1)} facturas")
        print(f"fecha_envio_tesoreria    actualizada en {len(filas2)} facturas")
        print(f"fecha_cierre             actualizada en {len(filas3)} facturas")

asyncio.run(fix())
