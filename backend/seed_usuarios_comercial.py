"""
Crea (idempotente) usuarios con rol 'comercial' (Tarjeta Comercial).
- Contraseña por defecto: cq123456 (el usuario la cambia en el primer ingreso).
- Sin área ni unidad de negocio (el flujo comercial no las exige).

Ejecutar:  python seed_usuarios_comercial.py
Lee DATABASE_URL del .env del mismo directorio.

IMPORTANTE: requiere que el rol 'comercial' YA exista (migración n8o9p0q1r2s3).
En producción: primero  git pull && alembic upgrade head && restart del servicio,
y luego correr este script en el servidor EC2.
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
ROLE_CODE = "comercial"
DEFAULT_PASSWORD = "cq123456"
DOMINIO = "@cafequindio.com.co"

# (nombre, prefijo_correo)  -> el correo final es prefijo + DOMINIO (en minúscula)
USUARIOS = [
    ("Maria Camila Reinoso",     "ventasmedellin"),
    ("Julian Maldonado",         "ventascali"),
    ("Brenda Vargas",            "ventascosta"),
    ("Diana Hurtado",            "ventasbogota"),
    ("Rafael Fonseca",           "ventasbogota1"),
    ("Johan Medina",             "ventasbogota2"),
    ("Alexander Velasquez",      "ventasbogota3"),
    ("Johanna Toro",             "ventasvipcentrooriente"),
    ("Maria Teresa Florian",     "ventasvipsuroccidente"),
    ("Jennifer Jacome",          "jefecuentasclave"),
    ("Cristian Molina",          "directorfoodservice"),
    ("Vanessa Galindo",          "ventasejecafetero"),
    ("Vacante",                  "ventasmanizales"),
    ("Luisa Clavijo",            "ventaspereira"),
    ("Luz Karime Garcia",        "ventasquindio1"),
    ("Maria del Carmen David",   "ventasquindio2"),
    ("Jennifer Contreras",       "ventasquindio3"),
    ("Adriana Valencia",         "ventasremotas"),
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
            print(f"ERROR: no existe el rol '{ROLE_CODE}'. Aplica la migración primero (alembic upgrade head).")
            await engine.dispose()
            return
        role_id = row[0]
        ph = hash_password(DEFAULT_PASSWORD)

        for nombre, prefijo in USUARIOS:
            email = f"{prefijo.lower()}{DOMINIO}"
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
            print(f"OK: creado  {email:42} ({nombre})")
            creados += 1

        await db.commit()

    await engine.dispose()
    print(f"\nResumen: {creados} creados, {existentes} ya existían.")
    print(f"Rol: {ROLE_CODE} | Contraseña inicial: {DEFAULT_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(main())
