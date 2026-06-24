"""
Crea tiendas "CAFE QUINDIO EXPRESS" con su usuario padre (rol responsable).

Por cada nombre de TIENDAS:
  - Crea un Area (es_tienda=true) con code = nombre = el nombre dado.
  - Crea su usuario "padre" con rol 'responsable', atado a esa area (area_id),
    email tienda.<slug-corto>@cafequindio.com.co y must_change_password=true.

El slug-corto quita el prefijo "CAFE QUINDIO EXPRESS " y kebab-caseen el resto
(ej: "...PASEO VILLA DEL RIO" -> tienda.paseo-villa-del-rio@cafequindio.com.co),
igual que las tiendas actuales (tienda.aeropuerto-el-dorado, etc.).

Seguridad:
  - Sin --confirmar => DRY-RUN: solo reporta qué crearía. No cambia nada.
  - Idempotente: si el area (por code o nombre) o el email ya existen, se omiten.
  - Todo corre en UNA transacción; si algo falla, se revierte completo.

Uso (en el EC2, donde Aurora es accesible):
  python crear_tiendas_express.py                # dry-run
  python crear_tiendas_express.py --confirmar    # aplica

Personalizable por entorno:
  TIENDA_PASSWORD (default: CafeQuindio2026)

Lee DATABASE_URL del entorno (o del .env de este directorio).
"""
import argparse
import asyncio
import os
import re
import unicodedata
import uuid
from pathlib import Path

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

from core.security import hash_password

# Cargar .env si existe (mismo patrón que create_responsable_tiendas.py)
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

DATABASE_URL = os.environ["DATABASE_URL"]
TIENDA_PASSWORD = os.environ.get("TIENDA_PASSWORD", "CafeQuindio2026")

PREFIJO = "CAFE QUINDIO EXPRESS "

TIENDAS = [
    "CAFE QUINDIO EXPRESS PASEO VILLA DEL RIO",
    "CAFE QUINDIO EXPRESS 86 ONCE",
    "CAFE QUINDIO EXPRESS AEROPUERTO EL DORADO 2",
    "CAFE QUINDIO EXPRESS RAPPI",
    "CAFE QUINDIO EXPRESS UNICO OUTLET CALI",
    "CAFE QUINDIO EXPRESS LLANO GRANDE",
    "CAFE QUINDIO EXPRESS NUESTRO CARTAGO",
    "CAFE QUINDIO EXPRESS GASTRO RIO",
    "CAFE QUINDIO EXPRESS CENCO ALTOS DEL PRADO",
    "CAFE QUINDIO EXPRESS PLAZA FLORA",
    "CAFE QUINDIO EXPRESS TATAMA",
]


def slug_corto(nombre: str) -> str:
    """Quita el prefijo de marca y kebab-casea el resto (sin acentos)."""
    base = nombre[len(PREFIJO):] if nombre.startswith(PREFIJO) else nombre
    base = unicodedata.normalize("NFKD", base).encode("ascii", "ignore").decode()
    base = base.lower().strip()
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")
    return base


async def main():
    parser = argparse.ArgumentParser(description="Crea tiendas CAFE QUINDIO EXPRESS con su usuario padre.")
    parser.add_argument("--confirmar", action="store_true", help="Aplica los cambios (sin esto = dry-run)")
    args = parser.parse_args()

    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # role_id del rol 'responsable'
        row = (await db.execute(text("SELECT id FROM roles WHERE code = 'responsable' LIMIT 1"))).fetchone()
        if not row:
            print("ERROR No existe el rol 'responsable'. Revisa la tabla roles.")
            await engine.dispose()
            return
        role_id = row[0]

        pwd_hash = hash_password(TIENDA_PASSWORD)
        a_crear, omitidas = [], []

        for nombre in TIENDAS:
            email = f"tienda.{slug_corto(nombre)}@cafequindio.com.co"
            user_nombre = f"Responsable {nombre[len(PREFIJO):]}" if nombre.startswith(PREFIJO) else f"Responsable {nombre}"

            area = (await db.execute(
                text("SELECT id FROM areas WHERE code = :c OR nombre = :n"),
                {"c": nombre, "n": nombre},
            )).fetchone()
            user = (await db.execute(
                text("SELECT id FROM users WHERE email = :e"), {"e": email}
            )).fetchone()

            if area and user:
                omitidas.append((nombre, email, "area y usuario ya existen"))
                continue

            a_crear.append({
                "nombre": nombre,
                "email": email,
                "user_nombre": user_nombre,
                "area_exists": area is not None,
                "area_id": area[0] if area else None,
                "user_exists": user is not None,
            })

        print(f"Rol responsable: {role_id}")
        print(f"Contraseña inicial: {TIENDA_PASSWORD} (deberán cambiarla al primer ingreso)\n")
        print(f"A crear: {len(a_crear)}   |   Omitidas (ya existen): {len(omitidas)}\n")
        for o in omitidas:
            print(f"  [SKIP] {o[0]}  ({o[2]})")
        for c in a_crear:
            faltan = []
            if not c["area_exists"]:
                faltan.append("area")
            if not c["user_exists"]:
                faltan.append("usuario")
            print(f"  [NEW]  {c['nombre']}  ->  {c['email']}   (crea: {', '.join(faltan)})")

        if not args.confirmar:
            print("\n[DRY-RUN] No se cambió nada. Vuelve a ejecutar con --confirmar para aplicar.")
            await engine.dispose()
            return

        try:
            for c in a_crear:
                area_id = c["area_id"]
                if not c["area_exists"]:
                    area_id = uuid.uuid4()
                    await db.execute(text("""
                        INSERT INTO areas (id, code, nombre, es_tienda)
                        VALUES (:id, :code, :nombre, true)
                    """), {"id": area_id, "code": c["nombre"], "nombre": c["nombre"]})
                if not c["user_exists"]:
                    await db.execute(text("""
                        INSERT INTO users (id, nombre, email, password_hash, role_id, area_id,
                                           is_active, must_change_password, created_at, updated_at)
                        VALUES (:id, :nombre, :email, :pwd, :role_id, :area_id, true, true,
                                NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC')
                    """), {
                        "id": uuid.uuid4(),
                        "nombre": c["user_nombre"],
                        "email": c["email"],
                        "pwd": pwd_hash,
                        "role_id": role_id,
                        "area_id": area_id,
                    })
            await db.commit()
            print(f"\nOK Se crearon {len(a_crear)} tiendas con su usuario padre.")
        except Exception as e:
            await db.rollback()
            print(f"\nERROR (se revirtió todo, no se cambió nada): {e}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
