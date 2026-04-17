"""
Script para crear el usuario administrador inicial.
Ejecutar: python create_admin.py
Lee DATABASE_URL del entorno (o del archivo .env en el mismo directorio).
"""
import asyncio
import uuid
import os
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from core.security import hash_password

# Cargar .env si existe
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

DATABASE_URL = os.environ["DATABASE_URL"]

ADMIN_NOMBRE   = "Administrador"
ADMIN_EMAIL    = "admin@cafequindio.com"
ADMIN_PASSWORD = "CafeQuindio2026"


async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Buscar role_id del rol admin
        result = await db.execute(text("SELECT id FROM roles WHERE code = 'admin' LIMIT 1"))
        row = result.fetchone()
        if not row:
            print("ERROR No se encontró el rol 'admin' en la tabla roles. Ejecuta primero las migraciones.")
            return
        role_id = row[0]

        # Verificar si ya existe el usuario
        result = await db.execute(text("SELECT id FROM users WHERE email = :email"), {"email": ADMIN_EMAIL})
        existing = result.fetchone()
        if existing:
            print(f"AVISO  Ya existe un usuario con el email {ADMIN_EMAIL}")
            print(f"   ID: {existing[0]}")
            return

        # Crear usuario
        user_id = uuid.uuid4()
        pwd_hash = hash_password(ADMIN_PASSWORD)

        await db.execute(text("""
            INSERT INTO users (id, nombre, email, password_hash, role_id, is_active, must_change_password, created_at, updated_at)
            VALUES (:id, :nombre, :email, :password_hash, :role_id, true, false,
                    NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC')
        """), {
            "id": user_id,
            "nombre": ADMIN_NOMBRE,
            "email": ADMIN_EMAIL,
            "password_hash": pwd_hash,
            "role_id": role_id,
        })
        await db.commit()

        print("OK Usuario admin creado exitosamente:")
        print(f"   Email:      {ADMIN_EMAIL}")
        print(f"   Contraseña: {ADMIN_PASSWORD}")
        print(f"   ID:         {user_id}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
