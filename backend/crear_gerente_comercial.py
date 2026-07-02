"""
Crea (o repara) el Gerente Comercial en la tabla `aprobadores_gerencia`.

Por qué existe:
  El flujo `tarjeta_comercial` auto-asigna, al enviar el paquete, el gerente
  comercial activo (categoria='comercial', is_active=true). Si no hay ninguno,
  el POST /gastos/paquetes/{id}/enviar responde 400:
  "No hay un gerente comercial configurado. Contacta al administrador."

Qué hace (idempotente y seguro):
  - Si NO existe un aprobador con el email dado -> lo INSERTA
    (categoria='comercial', is_active=true).
  - Si YA existe con ese email -> lo ACTIVA y le fija categoria='comercial'
    (no crea duplicados; el email es UNIQUE en la tabla).
  - Sin --confirmar => DRY-RUN: solo reporta qué haría. No cambia nada.
  - Todo corre en UNA transacción; si algo falla, se revierte completo.

Uso (en el EC2, donde Aurora es accesible):
  python crear_gerente_comercial.py                 # dry-run
  python crear_gerente_comercial.py --confirmar      # aplica

Lee DATABASE_URL del entorno (o del .env de este directorio).
"""
import argparse
import asyncio
import os
from pathlib import Path

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

# Datos del gerente comercial a garantizar
NOMBRE = "Juan David Cadavid"
CARGO = "Gerente Comercial"
EMAIL = "gerenciacomercial@cafequindio.com.co"

# Cargar .env si existe (mismo patrón que eliminar_paquetes.py)
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

DATABASE_URL = os.environ["DATABASE_URL"]


async def main():
    parser = argparse.ArgumentParser(description="Crea/repara el gerente comercial.")
    parser.add_argument("--confirmar", action="store_true",
                        help="Aplica los cambios (sin esto = dry-run)")
    args = parser.parse_args()

    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # ¿Hay ya algún gerente comercial activo?
        activos = (await db.execute(text("""
            SELECT id, nombre, email, is_active, categoria
            FROM aprobadores_gerencia
            WHERE categoria = 'comercial' AND is_active = true
            ORDER BY nombre
        """))).fetchall()

        print(f"Gerentes comerciales activos actualmente: {len(activos)}")
        for r in activos:
            print(f"  - {r[1]} <{r[2]}> categoria={r[4]} activo={r[3]}")

        # ¿Existe ya una fila con ese email (en cualquier estado/categoria)?
        existente = (await db.execute(
            text("""
                SELECT id, nombre, email, is_active, categoria
                FROM aprobadores_gerencia
                WHERE lower(email) = lower(:email)
            """),
            {"email": EMAIL},
        )).fetchone()

        if existente:
            accion = (f"ACTUALIZAR fila existente ({existente[0]}): "
                      f"is_active {existente[3]}->true, categoria {existente[4]}->comercial")
        else:
            accion = f"INSERTAR nuevo aprobador: {NOMBRE} <{EMAIL}> (comercial, activo)"

        print(f"\nAccion a realizar: {accion}")

        if not args.confirmar:
            print("\n[DRY-RUN] No se cambio nada. Vuelve a ejecutar con --confirmar para aplicar.")
            await engine.dispose()
            return

        try:
            if existente:
                await db.execute(
                    text("""
                        UPDATE aprobadores_gerencia
                        SET is_active = true, categoria = 'comercial', nombre = :nombre, cargo = :cargo
                        WHERE id = :id
                    """),
                    {"id": existente[0], "nombre": NOMBRE, "cargo": CARGO},
                )
            else:
                await db.execute(
                    text("""
                        INSERT INTO aprobadores_gerencia (id, nombre, cargo, email, is_active, categoria)
                        VALUES (gen_random_uuid(), :nombre, :cargo, :email, true, 'comercial')
                    """),
                    {"nombre": NOMBRE, "cargo": CARGO, "email": EMAIL},
                )
            await db.commit()

            # Releer para confirmar
            final = (await db.execute(
                text("""
                    SELECT id, nombre, email, is_active, categoria
                    FROM aprobadores_gerencia
                    WHERE lower(email) = lower(:email)
                """),
                {"email": EMAIL},
            )).fetchone()
            print("\nOK. Gerente comercial garantizado:")
            print(f"  {final[1]} <{final[2]}> | categoria={final[4]} | activo={final[3]} | id={final[0]}")
        except Exception as e:
            await db.rollback()
            print(f"\nERROR (se revirtio todo, no se cambio nada): {e}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
