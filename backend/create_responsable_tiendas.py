"""
Crea el usuario con perfil "Responsable de Tiendas" (rol responsable_tiendas).

Este usuario NO se ata a una tienda: su bandeja muestra las facturas de TODAS las
áreas marcadas como tienda (areas.es_tienda = true) y puede capturar OCT/ECT/FPC y
enviarlas a Contabilidad, igual que un responsable de tienda.

Requiere haber aplicado antes la migración k5f6a7b8c9d0 (crea el rol).
Ejecutar: python create_responsable_tiendas.py
Lee DATABASE_URL del entorno (o del .env en este directorio).

Personalizable por variables de entorno:
  RT_NOMBRE, RT_EMAIL, RT_PASSWORD
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

RT_NOMBRE   = os.environ.get("RT_NOMBRE", "Responsable de Tiendas")
RT_EMAIL    = os.environ.get("RT_EMAIL", "tiendas@cafequindio.com")
RT_PASSWORD = os.environ.get("RT_PASSWORD", "CafeQuindio2026")


async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # role_id del rol responsable_tiendas
        result = await db.execute(text("SELECT id FROM roles WHERE code = 'responsable_tiendas' LIMIT 1"))
        row = result.fetchone()
        if not row:
            print("ERROR No existe el rol 'responsable_tiendas'. Ejecuta primero la migración (alembic upgrade head).")
            return
        role_id = row[0]

        # ¿Ya existe el usuario?
        result = await db.execute(text("SELECT id FROM users WHERE email = :email"), {"email": RT_EMAIL})
        existing = result.fetchone()
        if existing:
            print(f"AVISO  Ya existe un usuario con el email {RT_EMAIL} (ID: {existing[0]}).")
            return

        # Crear usuario (area_id NULL: opera sobre todas las tiendas; must_change_password=true)
        user_id = uuid.uuid4()
        pwd_hash = hash_password(RT_PASSWORD)

        await db.execute(text("""
            INSERT INTO users (id, nombre, email, password_hash, role_id, area_id, is_active, must_change_password, created_at, updated_at)
            VALUES (:id, :nombre, :email, :password_hash, :role_id, NULL, true, true,
                    NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC')
        """), {
            "id": user_id,
            "nombre": RT_NOMBRE,
            "email": RT_EMAIL,
            "password_hash": pwd_hash,
            "role_id": role_id,
        })
        await db.commit()

        print("OK Usuario 'Responsable de Tiendas' creado:")
        print(f"   Email:      {RT_EMAIL}")
        print(f"   Contraseña: {RT_PASSWORD} (deberá cambiarla al primer ingreso)")
        print(f"   ID:         {user_id}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
