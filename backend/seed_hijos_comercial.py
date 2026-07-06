"""
Crea (idempotente) los hijos comerciales de un comercial padre.
Un hijo comercial es un vendedor SIN login: el padre legaliza paquetes
de tarjeta comercial a su nombre.

Ejecutar:  python seed_hijos_comercial.py
Lee DATABASE_URL del .env del mismo directorio.

IMPORTANTE: requiere la migración p0q1r2s3t4u5 (tabla comerciales_hijos)
y que el usuario padre ya exista (seed_usuarios_comercial.py).
"""
import asyncio
import uuid
import os
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

DATABASE_URL = os.environ["DATABASE_URL"]

# email del padre -> lista de nombres de hijos
HIJOS_POR_PADRE = {
    "ventasmedellin@cafequindio.com.co": [
        "QUINTERO BEDOYA WILSON ANDRES ROJAS",
        "MENESES LILIANA PATRICIA",
        "USUGA GALLEGO MARIA STEPHANIE",
    ],
    "ventasbogota@cafequindio.com.co": [
        "RAMIREZ ZARABANDA DIANA CAROLINA",
        "CRISTIANO CHIQUILLO NELLY JOHANNA",
        "VELASQUEZ RODRIGUEZ ALEXANDER",
        "CAMELO FONSECA LUIS RAFAEL",
        "RODRIGUEZ RAMIREZ LEIDY PAOLA",
        "MERCADO LOPEZ YULISA",
        "CHAVARRO GUZMAN DIANA ALEXANDRA",
        "JARAMILLO DIAZ ANDRES YOBANY",
        "HEREDIA PALOMINO DIANA MARCELA",
    ],
    "ventascali@cafequindio.com.co": [
        "TORRES MONTERO ANGIE ESTEFANIA",
        "CAPOTE NUÑEZ JESENIA",
    ],
    "ventascosta@cafequindio.com.co": [
        "ARANGO VIZCAINO KAREN ROSSANA",
        "TORRES SIMANCAS GIZELA",
    ],
    "directorfoodservice@cafequindio.com.co": [
        "FLORIAN SUAREZ MARIA TERESA",
        "TORO GARCIA JOHANNA MARIA",
    ],
    "ventasejecafetero@cafequindio.com.co": [
        "OSPINA OCAMPO ESTEBAN",
        "LOAIZA NATALY",
        "CLAVIJO YEPES LUISA FERNANDA",
        "DAVID CASTAÑO MARIA DEL CARMEN",
        "SANCHEZ CARMONA ANGY VANESSA",
        "CONTRERAS MUÑOZ JENNIFER",
        "TORO MARIA JOSE",
        "GARCIA SANCHEZ LUZ KARIME",
        "GIRALDO CARDONA MARIA ISABEL",
    ],
}


async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    creados, existentes = 0, 0
    async with async_session() as db:
        for email_padre, hijos in HIJOS_POR_PADRE.items():
            row = (await db.execute(
                text("SELECT id, nombre FROM users WHERE LOWER(email) = LOWER(:e)"),
                {"e": email_padre},
            )).fetchone()
            if not row:
                print(f"ERROR: no existe el usuario padre {email_padre}. Corre primero seed_usuarios_comercial.py")
                continue
            padre_id, padre_nombre = row[0], row[1]

            for nombre in hijos:
                existing = (await db.execute(text("""
                    SELECT id FROM comerciales_hijos
                    WHERE padre_user_id = :p AND UPPER(nombre) = UPPER(:n)
                """), {"p": padre_id, "n": nombre})).fetchone()
                if existing:
                    print(f"AVISO: ya existe '{nombre}' para {email_padre} (sin cambios)")
                    existentes += 1
                    continue

                await db.execute(text("""
                    INSERT INTO comerciales_hijos
                        (id, padre_user_id, nombre, is_active, created_at, updated_at)
                    VALUES
                        (:id, :p, :n, true, NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC')
                """), {"id": uuid.uuid4(), "p": padre_id, "n": nombre})
                print(f"OK: creado hijo '{nombre}' para {padre_nombre} ({email_padre})")
                creados += 1

        await db.commit()

    await engine.dispose()
    print(f"\nResumen: {creados} creados, {existentes} ya existían.")


if __name__ == "__main__":
    asyncio.run(main())
