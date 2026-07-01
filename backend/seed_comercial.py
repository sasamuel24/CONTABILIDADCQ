"""
Seed de prueba para el flujo Tarjeta Comercial.
Crea (idempotente):
  - Usuario rol 'comercial'   -> crea y envía paquetes de tarjeta comercial
  - Usuario rol 'responsable' -> valida los paquetes (sección "Validación Comercial")
  - 1 gerente aprobador con categoria='comercial' -> seleccionable al enviar

Ejecutar:  python seed_comercial.py
Lee DATABASE_URL del .env del mismo directorio.
Requiere que la migración n8o9p0q1r2s3 ya esté aplicada (alembic upgrade head).
"""
import asyncio
import uuid
import os
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from core.security import hash_password

_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

DATABASE_URL = os.environ["DATABASE_URL"]

USUARIOS = [
    # (nombre, email, password, role_code)
    ("Comercial Prueba",    "comercial@cafequindio.com.co",       "Comercial2026",   "comercial"),
    ("Asistente de Ventas", "asistenteventas@cafequindio.com.co", "Validador2026",   "responsable"),
]

GERENTE_COMERCIAL = {
    "nombre": "Gerencia Comercial",
    "cargo": "Gerente Comercial",
    "email": "gerenciacomercial@cafequindio.com.co",
    "categoria": "comercial",
}


async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # --- Usuarios ---
        for nombre, email, password, role_code in USUARIOS:
            row = (await db.execute(
                text("SELECT id FROM roles WHERE code = :c LIMIT 1"), {"c": role_code}
            )).fetchone()
            if not row:
                print(f"ERROR: no existe el rol '{role_code}'. Corre 'alembic upgrade head' primero.")
                continue
            role_id = row[0]

            existing = (await db.execute(
                text("SELECT id FROM users WHERE email = :e"), {"e": email}
            )).fetchone()
            if existing:
                # Ya existe: ajusta el rol y lo deja activo (no cambia la contraseña actual)
                await db.execute(text(
                    "UPDATE users SET role_id = :rid, is_active = true WHERE email = :e"
                ), {"rid": role_id, "e": email})
                print(f"OK: {email} ya existía -> rol ajustado a '{role_code}' (contraseña SIN cambios)")
                continue

            await db.execute(text("""
                INSERT INTO users (id, nombre, email, password_hash, role_id, is_active, must_change_password, created_at, updated_at)
                VALUES (:id, :nombre, :email, :ph, :role_id, true, false,
                        NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC')
            """), {
                "id": uuid.uuid4(), "nombre": nombre, "email": email,
                "ph": hash_password(password), "role_id": role_id,
            })
            print(f"OK: usuario creado  {email} / {password}  (rol {role_code})")

        # --- Gerente comercial ---
        g = GERENTE_COMERCIAL
        exists = (await db.execute(
            text("SELECT id FROM aprobadores_gerencia WHERE email = :e"), {"e": g["email"]}
        )).fetchone()
        if exists:
            # Asegura que quede como categoria comercial y activo
            await db.execute(text(
                "UPDATE aprobadores_gerencia SET categoria='comercial', is_active=true WHERE email = :e"
            ), {"e": g["email"]})
            print(f"AVISO: gerente {g['email']} ya existía -> actualizado a categoria comercial/activo")
        else:
            await db.execute(text("""
                INSERT INTO aprobadores_gerencia (id, nombre, cargo, email, is_active, categoria, created_at, updated_at)
                VALUES (:id, :nombre, :cargo, :email, true, :categoria,
                        NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC')
            """), {"id": uuid.uuid4(), **g})
            print(f"OK: gerente comercial creado  {g['email']}")

        await db.commit()

    await engine.dispose()
    print("\nListo. Credenciales:")
    for nombre, email, password, role_code in USUARIOS:
        print(f"  - {role_code:12} {email}  /  {password}")


if __name__ == "__main__":
    asyncio.run(main())
