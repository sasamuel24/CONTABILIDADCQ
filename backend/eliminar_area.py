"""
Elimina un área de forma SEGURA, tratando antes sus dependencias.

Por qué hace falta: las FK que apuntan a `areas.id` con RESTRICT/NO ACTION
(facturas.area_id, facturas.area_origen_id, factura_asignaciones.area_id,
paquetes_gastos.area_id) impiden borrar un área que tenga registros asociados.
`users.area_id` es ON DELETE SET NULL, así que esos usuarios quedan "Sin área"
automáticamente.

Modos:
  --reasignar-a <UUID>   Mueve facturas / asignaciones / paquetes del área a OTRA
                         área destino y luego borra el área. NO destruye datos.
                         (RECOMENDADO)
  --eliminar-dependencias  BORRA las facturas del área (y sus hijos en cascada:
                         archivos, comentarios, inventario, carpetas, tokens),
                         sus asignaciones y sus paquetes; pone a NULL el origen de
                         otras facturas que se originaron aquí; y borra el área.
                         DESTRUCTIVO E IRREVERSIBLE.

Seguridad:
  - Sin --confirmar => DRY-RUN: solo reporta cuántos registros hay. No cambia nada.
  - Todo corre en UNA transacción; si algo falla, se revierte completo.
  - El borrado duro exige además --si-estoy-seguro.

Uso (en el EC2, donde Aurora es accesible):
  python eliminar_area.py --area-id 26d87fd6-fad2-40fe-99ba-9408312c2197            # dry-run
  python eliminar_area.py --area-id <UUID> --reasignar-a <UUID_DESTINO> --confirmar
  python eliminar_area.py --area-id <UUID> --eliminar-dependencias --si-estoy-seguro --confirmar

Lee DATABASE_URL del entorno (o del .env de este directorio).
"""
import argparse
import asyncio
import os
from pathlib import Path

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

# Cargar .env si existe (mismo patrón que create_responsable_tiendas.py)
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

DATABASE_URL = os.environ["DATABASE_URL"]


async def _contar(db, sql, params):
    return (await db.execute(text(sql), params)).scalar() or 0


async def main():
    parser = argparse.ArgumentParser(description="Elimina un área tratando sus dependencias.")
    parser.add_argument("--area-id", required=True, help="UUID del área a eliminar")
    parser.add_argument("--reasignar-a", default=None, help="UUID del área destino (mueve los registros allí)")
    parser.add_argument("--eliminar-dependencias", action="store_true", help="Borra facturas/asignaciones/paquetes del área")
    parser.add_argument("--confirmar", action="store_true", help="Aplica los cambios (sin esto = dry-run)")
    parser.add_argument("--si-estoy-seguro", action="store_true", help="Obligatorio para el borrado duro")
    args = parser.parse_args()

    area_id = args.area_id
    target = args.reasignar_a

    if args.eliminar_dependencias and target:
        print("ERROR: usa --reasignar-a O --eliminar-dependencias, no ambos.")
        return
    if args.confirmar and not args.eliminar_dependencias and not target:
        print("ERROR: para aplicar debes elegir --reasignar-a <UUID> o --eliminar-dependencias.")
        return
    if args.confirmar and args.eliminar_dependencias and not args.si_estoy_seguro:
        print("ERROR: el borrado duro requiere además --si-estoy-seguro.")
        return

    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Validar área
        row = (await db.execute(
            text("SELECT id, code, nombre, es_tienda FROM areas WHERE id = :id"),
            {"id": area_id},
        )).fetchone()
        if not row:
            print(f"ERROR: no existe un área con id {area_id}.")
            await engine.dispose()
            return
        print(f"Área objetivo: {row[2]} (code={row[1]}, es_tienda={row[3]})")

        # Reportar dependencias
        p = {"id": area_id}
        fact_area     = await _contar(db, "SELECT count(*) FROM facturas WHERE area_id = :id", p)
        fact_origen   = await _contar(db, "SELECT count(*) FROM facturas WHERE area_origen_id = :id", p)
        asignaciones  = await _contar(db, "SELECT count(*) FROM factura_asignaciones WHERE area_id = :id", p)
        paquetes      = await _contar(db, "SELECT count(*) FROM paquetes_gastos WHERE area_id = :id", p)
        usuarios      = await _contar(db, "SELECT count(*) FROM users WHERE area_id = :id", p)
        print("\nDependencias actuales:")
        print(f"  facturas (area_id)        : {fact_area}")
        print(f"  facturas (area_origen_id) : {fact_origen}")
        print(f"  factura_asignaciones      : {asignaciones}")
        print(f"  paquetes_gastos           : {paquetes}")
        print(f"  usuarios (se pondrán Sin área): {usuarios}")

        if not args.confirmar:
            print("\n[DRY-RUN] No se cambió nada. Vuelve a ejecutar con --confirmar y un modo para aplicar.")
            await engine.dispose()
            return

        # Validar destino si aplica
        if target:
            t = (await db.execute(text("SELECT nombre FROM areas WHERE id = :id"), {"id": target})).fetchone()
            if not t:
                print(f"ERROR: el área destino {target} no existe.")
                await engine.dispose()
                return
            if target == area_id:
                print("ERROR: el área destino no puede ser la misma que se elimina.")
                await engine.dispose()
                return
            print(f"\nReasignando registros a: {t[0]} ({target})")

        try:
            if target:
                # MODO REASIGNAR (no destruye datos)
                await db.execute(text("UPDATE facturas SET area_id = :t WHERE area_id = :id"), {"t": target, "id": area_id})
                await db.execute(text("UPDATE facturas SET area_origen_id = :t WHERE area_origen_id = :id"), {"t": target, "id": area_id})
                await db.execute(text("UPDATE factura_asignaciones SET area_id = :t WHERE area_id = :id"), {"t": target, "id": area_id})
                await db.execute(text("UPDATE paquetes_gastos SET area_id = :t WHERE area_id = :id"), {"t": target, "id": area_id})
            else:
                # MODO BORRADO DURO (destructivo)
                # 1) asignaciones de las facturas del área (factura_asignaciones.factura_id es NO ACTION)
                await db.execute(text(
                    "DELETE FROM factura_asignaciones WHERE factura_id IN (SELECT id FROM facturas WHERE area_id = :id)"
                ), p)
                # 2) asignaciones que apuntan directo al área
                await db.execute(text("DELETE FROM factura_asignaciones WHERE area_id = :id"), p)
                # 3) otras facturas que SOLO se originaron aquí: limpiar el origen (no borrarlas)
                await db.execute(text("UPDATE facturas SET area_origen_id = NULL WHERE area_origen_id = :id"), p)
                # 4) borrar las facturas del área (hijos caen en CASCADE)
                await db.execute(text("DELETE FROM facturas WHERE area_id = :id"), p)
                # 5) paquetes del área
                await db.execute(text("DELETE FROM paquetes_gastos WHERE area_id = :id"), p)

            # usuarios: ON DELETE SET NULL lo hace solo al borrar el área
            await db.execute(text("DELETE FROM areas WHERE id = :id"), p)
            await db.commit()
            print("\nOK Área eliminada correctamente.")
        except Exception as e:
            await db.rollback()
            print(f"\nERROR (se revirtió todo, no se cambió nada): {e}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
