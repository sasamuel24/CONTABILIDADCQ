"""
Script de corrección de encoding en la tabla areas.
El problema es UTF-8 guardado como Latin-1 (mojibake clásico).
Ej: "AdministraciÃ³n" → "Administración"

Uso:
  python fix_encoding_areas.py            ← usa BD local del .env
  python fix_encoding_areas.py --prod     ← usa BD de producción (RDS)
  python fix_encoding_areas.py --dry-run  ← solo muestra cambios, no actualiza
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

DRY_RUN = "--dry-run" in sys.argv
USE_PROD = "--prod" in sys.argv


def fix_encoding(text: str) -> str:
    """Convierte texto con mojibake (UTF-8 leído como Latin-1) al texto correcto."""
    if not text:
        return text
    try:
        return text.encode("latin-1").decode("utf-8")
    except (UnicodeDecodeError, UnicodeEncodeError):
        return text  # Ya está bien o no se puede corregir


async def main():
    import asyncpg
    from dotenv import load_dotenv

    load_dotenv()

    if USE_PROD:
        dsn = (
            "postgresql://postgres:TU_PASSWORD@"
            "database-1.chgqoo4oaal4.us-east-2.rds.amazonaws.com:5432/contabilidadcq"
        )
        print("⚠️  Conectando a PRODUCCIÓN (RDS)")
    else:
        raw = os.getenv("DATABASE_URL", "")
        # asyncpg necesita postgresql://, no postgresql+asyncpg://
        dsn = raw.replace("postgresql+asyncpg://", "postgresql://")
        print(f"Conectando a BD local: {dsn[:40]}...")

    conn = await asyncpg.connect(dsn)

    try:
        filas = await conn.fetch("SELECT id, code, nombre FROM areas ORDER BY nombre")

        print(f"\nTotal de áreas: {len(filas)}")
        print("-" * 60)

        cambios = []
        for fila in filas:
            id_      = fila["id"]
            code_orig  = fila["code"]
            nombre_orig = fila["nombre"]

            code_fix   = fix_encoding(code_orig)
            nombre_fix = fix_encoding(nombre_orig)

            if code_fix != code_orig or nombre_fix != nombre_orig:
                cambios.append({
                    "id": id_,
                    "code_orig": code_orig,
                    "code_fix": code_fix,
                    "nombre_orig": nombre_orig,
                    "nombre_fix": nombre_fix,
                })
                print(f"  ANTES:  nombre='{nombre_orig}'  code='{code_orig}'")
                print(f"  DESPUES: nombre='{nombre_fix}'  code='{code_fix}'")
                print()

        print(f"\n{len(cambios)} área(s) con encoding a corregir.")

        if not cambios:
            print("No hay nada que corregir.")
            return

        if DRY_RUN:
            print("\n[DRY RUN] No se aplicaron cambios.")
            return

        confirmar = input("\n¿Aplicar correcciones? (s/n): ").strip().lower()
        if confirmar != "s":
            print("Cancelado.")
            return

        for c in cambios:
            await conn.execute(
                "UPDATE areas SET nombre = $1, code = $2 WHERE id = $3",
                c["nombre_fix"], c["code_fix"], c["id"]
            )

        print(f"\n✓ {len(cambios)} área(s) corregidas correctamente.")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
