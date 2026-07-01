"""
Crea (idempotente) usuarios con rol 'tarjeta_cq' (Responsable Tarjeta CQ).
- Contraseña por defecto: cq123456 (el usuario la cambia en el primer ingreso).
- Unidad de Negocio: VACÍA (se asigna luego desde el admin, por usuario).

Ejecutar:  python seed_usuarios_tarjeta_cq.py
Lee DATABASE_URL del .env del mismo directorio.
Requiere que el rol 'tarjeta_cq' exista en la tabla roles.

IMPORTANTE (producción): correr en el servidor EC2, donde DATABASE_URL apunta a Aurora.
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
ROLE_CODE = "tarjeta_cq"
DEFAULT_PASSWORD = "cq123456"

# (nombre, email)
USUARIOS = [
    ("Daniel Gómez Gómez",        "cto@cafequindio.com.co"),
    ("Julian Andres Rivera",      "coordinadoralmacen@cafequindio.com.co"),
    ("María Isabel Torres",       "analistatiendas@cafequindio.com.co"),
    ("Juliana Andrea Amezquita",  "publicidad@cafequindio.com.co"),
    ("Maribel García",            "jefedezonatiendascentro@cafequindio.com.co"),
    ("Patricia Amar",             "administradortunja@cafequindio.com.co"),
    ("Vanessa Revelo",            "jefezonacali@cafequindio.com.co"),
    ("Adriana Ospina",            "jefedezonaquindio@cafequindio.com.co"),
    ("Javier Clavijo",            "jefedezonaejecafetero@cafequindio.com.co"),
    ("Paula Mejía",               "jefezonamedellin@cafequindio.com.co"),
    ("Oscar de Horta",            "jefezonacosta@cafequindio.com.co"),
    ("María Paula Cely",          "directorrestaurante@cafequindio.com.co"),
    ("Isabela Hoyos Maya",        "jefedezonatiendascentro2@cafequindio.com.co"),
    ("Camilo Andrés Torres",      "arquitectura@cafequindio.com.co"),
    ("Cesar Humberto Bohorquez",  "arquitectura5@cafequindio.com.co"),
    ("Angelica Godoy",            "auxiliararquitectura@cafequindio.com.co"),
]


async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    creados, existentes = 0, 0
    async with async_session() as db:
        row = (await db.execute(
            text("SELECT id FROM roles WHERE code = :c LIMIT 1"), {"c": ROLE_CODE}
        )).fetchone()
        if not row:
            print(f"ERROR: no existe el rol '{ROLE_CODE}'. Aplica las migraciones primero (alembic upgrade head).")
            await engine.dispose()
            return
        role_id = row[0]
        ph = hash_password(DEFAULT_PASSWORD)

        for nombre, email in USUARIOS:
            existing = (await db.execute(
                text("SELECT id FROM users WHERE email = :e"), {"e": email}
            )).fetchone()
            if existing:
                print(f"AVISO: ya existe {email} -> {existing[0]} (sin cambios)")
                existentes += 1
                continue

            await db.execute(text("""
                INSERT INTO users
                    (id, nombre, email, password_hash, role_id, area_id, unidad_negocio_id,
                     is_active, must_change_password, created_at, updated_at)
                VALUES
                    (:id, :nombre, :email, :ph, :role_id, NULL, NULL,
                     true, true, NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC')
            """), {"id": uuid.uuid4(), "nombre": nombre, "email": email, "ph": ph, "role_id": role_id})
            print(f"OK: creado  {email:45} ({nombre})")
            creados += 1

        await db.commit()

    await engine.dispose()
    print(f"\nResumen: {creados} creados, {existentes} ya existían.")
    print(f"Rol: {ROLE_CODE} | Contraseña inicial: {DEFAULT_PASSWORD} | Unidad de Negocio: (vacía, asignar luego)")


if __name__ == "__main__":
    asyncio.run(main())
