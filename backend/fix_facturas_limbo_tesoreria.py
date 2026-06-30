"""
Diagnostica y repara facturas "en el limbo" de Tesorería.

SÍNTOMA:
    Una factura aparece en estado 7 ("Pendiente en Tesorería") + área Tesorería,
    el usuario originador la ve, pero NO aparece en la bandeja de Tesorería y
    nunca pasó por Contabilidad.

CAUSA RAÍZ:
    La bandeja de Tesorería solo muestra facturas que están dentro de una carpeta
    (Factura.carpeta_id), y esa carpeta la asigna Contabilidad. Si una factura se
    asigna directamente al área Tesorería (vía POST /facturas/{id}/asignaciones,
    p.ej. desde la modal "Reasignar área"), queda en estado 7 SIN carpeta_id =>
    invisible en la bandeja, saltándose Contabilidad.

    => "En el limbo" = estado_id = 7 AND carpeta_id IS NULL.

REPARACIÓN:
    Regresa esas facturas a Contabilidad (área Contabilidad + estado 3
    "Pendiente en contabilidad") para que Contabilidad les asigne carpeta y las
    envíe correctamente a Tesorería por el flujo normal.

USO (apuntar DATABASE_URL a la BD de producción; correr en el servidor EC2 o
     vía túnel SSH a Aurora):

    # 1) Diagnóstico: listar TODAS las facturas en el limbo (no modifica nada)
    python fix_facturas_limbo_tesoreria.py

    # 2) Reparar UNA factura específica (la COMCEL del reporte)
    python fix_facturas_limbo_tesoreria.py --numero S3135484100 --apply

    # 3) Reparar TODAS las facturas en el limbo
    python fix_facturas_limbo_tesoreria.py --apply
"""
import argparse
import asyncio
import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DB = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:Samuel22.@localhost:5432/contabilidadcq",
)

CONTABILIDAD_ID = "725f5e5a-49d3-4e44-800f-f5ff21e187ac"
ESTADO_CONTABILIDAD = 3  # "Pendiente en contabilidad"
ESTADO_TESORERIA = 7     # "Pendiente en Tesorería"


async def run(apply: bool, numero: str | None):
    engine = create_async_engine(DB)

    where = "f.estado_id = :tes AND f.carpeta_id IS NULL"
    params = {"tes": ESTADO_TESORERIA}
    if numero:
        where += " AND f.numero_factura = :numero"
        params["numero"] = numero

    async with engine.connect() as conn:
        # --- Diagnóstico ---
        rows = (await conn.execute(text(f"""
            SELECT f.numero_factura,
                   f.proveedor,
                   f.total,
                   a.nombre AS area,
                   f.fecha_envio_contabilidad,
                   f.fecha_envio_tesoreria,
                   f.created_at
            FROM facturas f
            LEFT JOIN areas a ON a.id = f.area_id
            WHERE {where}
            ORDER BY f.created_at DESC
        """), params)).fetchall()

        print(f"\nFacturas en el limbo (estado 7 + carpeta_id NULL): {len(rows)}")
        print("-" * 90)
        for r in rows:
            paso_cont = "SÍ" if r[4] else "NO"
            print(
                f"  {r[0]:<18} {str(r[1])[:32]:<32} ${r[2]:>12,.0f}  "
                f"area={r[3]}  pasó_contab={paso_cont}"
            )
        print("-" * 90)

        if not rows:
            print("No hay facturas en el limbo. Nada que reparar.")
            await engine.dispose()
            return

        if not apply:
            print(
                "\n[DRY-RUN] No se modificó nada. Para reparar agrega --apply "
                "(opcionalmente con --numero <N> para una sola factura)."
            )
            await engine.dispose()
            return

        # --- Reparación: regresar a Contabilidad ---
        fixed = (await conn.execute(text(f"""
            UPDATE facturas f
            SET area_id = :cont,
                estado_id = :estado_cont,
                fecha_envio_contabilidad = COALESCE(f.fecha_envio_contabilidad, now()),
                fecha_envio_tesoreria = NULL,
                assigned_to_user_id = NULL
            WHERE {where}
            RETURNING f.numero_factura, f.proveedor
        """), {**params, "cont": CONTABILIDAD_ID, "estado_cont": ESTADO_CONTABILIDAD})).fetchall()
        await conn.commit()

        print(f"\n[APPLY] Reparadas {len(fixed)} factura(s) -> Contabilidad (estado 3):")
        for r in fixed:
            print(f"  {r[0]} - {r[1]}")
        print(
            "\nAhora deben aparecer en la bandeja de Contabilidad. Contabilidad les "
            "asigna carpeta y las envía a Tesorería por el flujo normal."
        )

    await engine.dispose()


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Diagnostica/repara facturas en el limbo de Tesorería")
    p.add_argument("--apply", action="store_true", help="Aplica la reparación (sin esto, solo diagnostica)")
    p.add_argument("--numero", help="Restringe a una factura por número (ej. S3135484100)")
    args = p.parse_args()
    asyncio.run(run(args.apply, args.numero))
