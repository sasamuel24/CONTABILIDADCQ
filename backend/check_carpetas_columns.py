"""Script para verificar columnas en carpetas."""
import asyncio
from sqlalchemy import text
from db.session import engine


async def check():
    async with engine.connect() as conn:
        result = await conn.execute(text("""
            SELECT column_name, is_nullable, data_type 
            FROM information_schema.columns 
            WHERE table_name='carpetas' 
            ORDER BY ordinal_position
        """))
        print("\nColumnas en tabla 'carpetas':")
        print("=" * 60)
        for row in result.fetchall():
            print(f"{row[0]}: {row[2]} (nullable={row[1]})")
        print("=" * 60)

asyncio.run(check())
