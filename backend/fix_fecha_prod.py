import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os

DB = os.environ.get("DATABASE_URL", "")

async def fix():
    engine = create_async_engine(DB)
    async with engine.connect() as conn:
        r = await conn.execute(text(
            "UPDATE facturas f "
            "SET fecha_envio_contabilidad = COALESCE(f.assigned_at, NOW()) "
            "WHERE f.fecha_envio_contabilidad IS NULL "
            "AND f.area_id IN (SELECT id FROM areas WHERE nombre ILIKE '%contabilidad%') "
            "RETURNING f.numero_factura, f.fecha_envio_contabilidad"
        ))
        rows = r.fetchall()
        await conn.commit()
        print("Actualizadas", len(rows), "facturas")
        for row in rows:
            print(" ", row[0], "->", row[1])
    await engine.dispose()

asyncio.run(fix())
