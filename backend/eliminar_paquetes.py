"""
Elimina uno o varios paquetes de legalización por su FOLIO (PKG-YYYY-NNNNN).

Por qué es seguro:
  - Todos los hijos del paquete tienen FK con ON DELETE CASCADE
    (gastos_legalizacion, archivos_gasto, comentarios_paquete,
     historial_estados_paquete, tokens_aprobacion_paquetes), así que un solo
    DELETE sobre paquetes_gastos arrastra todo lo asociado.
  - No hay tablas con FK RESTRICT apuntando al paquete que puedan bloquearlo.

Seguridad:
  - Sin --confirmar => DRY-RUN: solo reporta qué se borraría. No cambia nada.
  - Todo corre en UNA transacción; si algo falla, se revierte completo.

OJO (S3): este script NO borra los objetos de S3 (soportes/PDF). Quedan huérfanos
  en el bucket pero ya no referenciados. Si necesitas limpiarlos, hay que hacerlo
  aparte; normalmente es aceptable dejarlos.

Uso (en el EC2, donde Aurora es accesible):
  python eliminar_paquetes.py                       # dry-run con la lista por defecto
  python eliminar_paquetes.py --confirmar           # aplica el borrado
  python eliminar_paquetes.py --folios PKG-2026-00134 PKG-2026-00154   # otra lista

Lee DATABASE_URL del entorno (o del .env de este directorio).
"""
import argparse
import asyncio
import os
from pathlib import Path

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

# Folios a eliminar por defecto (los que pidió el usuario)
FOLIOS_DEFAULT = [
    "PKG-2026-00134",
    "PKG-2026-00154",
    "PKG-2026-00172",
    "PKG-2026-00180",
    "PKG-2026-00162",
    "PKG-2026-00164",
    "PKG-2026-00168",
]

# Cargar .env si existe (mismo patrón que eliminar_area.py)
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

DATABASE_URL = os.environ["DATABASE_URL"]


async def _scalar(db, sql, params):
    return (await db.execute(text(sql), params)).scalar() or 0


async def main():
    parser = argparse.ArgumentParser(description="Elimina paquetes de legalización por folio.")
    parser.add_argument("--folios", nargs="+", default=FOLIOS_DEFAULT,
                        help="Lista de folios PKG-... a eliminar")
    parser.add_argument("--confirmar", action="store_true",
                        help="Aplica el borrado (sin esto = dry-run)")
    args = parser.parse_args()

    folios = args.folios

    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Localizar los paquetes
        rows = (await db.execute(
            text("""
                SELECT p.id, p.folio, p.semana, p.estado, p.monto_total,
                       u.nombre AS tecnico
                FROM paquetes_gastos p
                LEFT JOIN users u ON u.id = p.user_id
                WHERE p.folio = ANY(:folios)
                ORDER BY p.folio
            """),
            {"folios": folios},
        )).fetchall()

        encontrados = {r[1] for r in rows}
        faltantes = [f for f in folios if f not in encontrados]

        print(f"Folios solicitados : {len(folios)}")
        print(f"Folios encontrados : {len(rows)}")
        if faltantes:
            print(f"NO encontrados     : {', '.join(faltantes)}")
        print()

        if not rows:
            print("No hay nada que borrar. Saliendo.")
            await engine.dispose()
            return

        ids = [r[0] for r in rows]
        print("Paquetes que se eliminarán (con sus hijos en cascada):")
        for r in rows:
            pid = r[0]
            n_gastos   = await _scalar(db, "SELECT count(*) FROM gastos_legalizacion WHERE paquete_id = :id", {"id": pid})
            n_archivos = await _scalar(db, "SELECT count(*) FROM archivos_gasto WHERE paquete_id = :id", {"id": pid})
            n_coment   = await _scalar(db, "SELECT count(*) FROM comentarios_paquete WHERE paquete_id = :id", {"id": pid})
            n_hist     = await _scalar(db, "SELECT count(*) FROM historial_estados_paquete WHERE paquete_id = :id", {"id": pid})
            print(f"  - {r[1]} | {r[5]} | {r[2]} | estado={r[3]} | monto={r[4]} | "
                  f"gastos={n_gastos} archivos={n_archivos} comentarios={n_coment} historial={n_hist}")

        if not args.confirmar:
            print("\n[DRY-RUN] No se cambió nada. Vuelve a ejecutar con --confirmar para aplicar.")
            await engine.dispose()
            return

        try:
            res = await db.execute(
                text("DELETE FROM paquetes_gastos WHERE id = ANY(:ids)"),
                {"ids": ids},
            )
            await db.commit()
            print(f"\nOK {res.rowcount} paquete(s) eliminado(s) correctamente (hijos en cascada).")
        except Exception as e:
            await db.rollback()
            print(f"\nERROR (se revirtió todo, no se cambió nada): {e}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
