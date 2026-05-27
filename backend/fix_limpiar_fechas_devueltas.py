"""
Limpia fecha_envio_contabilidad en facturas que fueron devueltas de Contabilidad
al responsable (estado_id=2, area_id != CONTABILIDAD_ID) pero tienen la fecha seteada.
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os

DB = os.environ.get("DATABASE_URL", "postgresql+asyncpg://postgres:Samuel22.@localhost:5432/contabilidadcq")
CONTABILIDAD_ID = '725f5e5a-49d3-4e44-800f-f5ff21e187ac'

async def fix():
    engine = create_async_engine(DB)
    async with engine.connect() as conn:
        r = await conn.execute(text(f"""
            UPDATE facturas
            SET fecha_envio_contabilidad = NULL
            WHERE estado_id = 2
              AND area_id != '{CONTABILIDAD_ID}'
              AND fecha_envio_contabilidad IS NOT NULL
            RETURNING numero_factura
        """))
        rows = r.fetchall()
        await conn.commit()
        print(f"Limpiadas {len(rows)} facturas devueltas con fecha_envio_contabilidad espuria:")
        for row in rows:
            print(f"  {row[0]}")
    await engine.dispose()

asyncio.run(fix())
