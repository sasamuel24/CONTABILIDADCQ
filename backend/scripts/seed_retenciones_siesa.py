"""
Seed masivo de retenciones estandarizadas por proveedor para causación Siesa FSP.

Lee la data maestra exportada del ERP (carpeta retenciones/ en la raíz del repo,
ver retenciones/LEEME_DATA.md) y puebla siesa_proveedor_config +
siesa_proveedor_retenciones, que son la fuente de verdad tributaria que el
modal "Causar en Siesa" precarga (service._prefill).

Reglas de carga (acordadas 20-Ago-2026):
- Solo retenciones con estado "Sujeto a retención" Y llave Y tarifa se cargan
  como filas de siesa_proveedor_retenciones (clase_imp_base "2", la del caso
  dorado). El builder ya aplica base_minima al causar.
- "Sujeto a retención" SIN llave en el ERP => NO se asume tarifa: queda como
  nota "PENDIENTE parametrizar" en el config, visible en el modal.
- Llave doble tipo "3040 / 3041" (duplicada en el ERP con tarifa idéntica) =>
  se usa la primera y se deja nota para que Contabilidad confirme la vigente.
- Autoretenedor en una clase => no se practica retención; se deja nota
  informativa para que la ausencia no parezca un faltante.
- ERP manda en la carga: las retenciones existentes del proveedor se
  REEMPLAZAN completas. Los demás campos del config guardados a mano desde el
  modal (tipo_proveedor, motivo, servicio, ccosto...) NO se tocan.

Uso (desde backend/, con el venv):
    python scripts/seed_retenciones_siesa.py --dry-run
    python scripts/seed_retenciones_siesa.py
"""
import argparse
import asyncio
import csv
import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from db.session import AsyncSessionLocal
from db.models import SiesaProveedorConfig, SiesaProveedorRetencion

DATA_DIR = Path(__file__).parent.parent.parent / "retenciones"
SIN_LLAVE = "(sin llave asignada)"
CLASES_MAESTRA = ["ica", "renta", "rtecomis", "rtehon", "rteserv"]
NOTA_PREFIX = "[Seed ERP 2026-08]"


def leer_csv(path: Path) -> list[dict]:
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def construir_plan(detalle: list[dict], maestra: list[dict]) -> dict[str, dict]:
    """
    Devuelve {nit: {"retenciones": [dict], "notas": [str], "razon_social": str}}
    solo para proveedores que aportan algo (retención usable, pendiente o
    condición de autoretenedor).
    """
    plan: dict[str, dict] = {}

    def entry(nit: str, razon: str) -> dict:
        if nit not in plan:
            plan[nit] = {"retenciones": [], "notas": [], "razon_social": razon}
        return plan[nit]

    for fila in detalle:
        nit = fila["codigo_nit"].strip()
        if not nit:
            continue
        clase = fila["clase_retencion"].strip()
        llave = fila["llave"].strip()
        if llave == SIN_LLAVE or not fila["tarifa_pct"]:
            e = entry(nit, fila["razon_social"])
            e["notas"].append(
                f"{clase} sujeta SIN llave en ERP - PENDIENTE parametrizar antes de causar"
            )
            continue
        nota_dupla = None
        if "/" in llave:
            nota_dupla = f"{clase}: llave duplicada en ERP ({llave}) - confirmar vigente con Contabilidad"
            llave = llave.split("/")[0].strip()
        e = entry(nit, fila["razon_social"])
        descripcion = f"{clase} - {fila['descripcion_llave'].strip()}".strip(" -")
        e["retenciones"].append(
            {
                "llave_retencion": llave,
                "tasa": Decimal(fila["tarifa_pct"]),
                "clase_imp_base": "2",
                "base_minima": Decimal(fila["base_minima"] or "0"),
                "descripcion": descripcion,
            }
        )
        if nota_dupla:
            e["notas"].append(nota_dupla)

    for fila in maestra:
        nit = fila["codigo_nit"].strip()
        if not nit:
            continue
        autos = [
            c.upper()
            for c in CLASES_MAESTRA
            if fila.get(f"{c}_estado", "").strip() == "Autoretenedor"
        ]
        if autos:
            e = entry(nit, fila["razon_social"])
            e["notas"].append(
                f"Autoretenedor en {', '.join(autos)} - no se le practica esa retención"
            )

    return plan


async def aplicar(plan: dict[str, dict], dry_run: bool) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(SiesaProveedorConfig).options(
                selectinload(SiesaProveedorConfig.retenciones)
            )
        )
        existentes = {c.nit: c for c in result.scalars().all()}

        creados = actualizados = 0
        reemplazadas_manual: list[str] = []
        total_ret = 0

        for nit, datos in sorted(plan.items()):
            nota_seed = ""
            if datos["notas"]:
                # dict.fromkeys deduplica conservando orden
                nota_seed = f"{NOTA_PREFIX} " + " | ".join(dict.fromkeys(datos["notas"]))

            config = existentes.get(nit)
            if config is None:
                config = SiesaProveedorConfig(nit=nit, sucursal="001")
                db.add(config)
                creados += 1
            else:
                if config.retenciones and datos["retenciones"]:
                    reemplazadas_manual.append(nit)
                actualizados += 1

            if nota_seed:
                actual = (config.notas or "").strip()
                if NOTA_PREFIX in actual:
                    # re-ejecución del seed: no duplicar la nota, refrescarla
                    manual = actual.split(NOTA_PREFIX)[0].strip(" |")
                    config.notas = f"{manual} | {nota_seed}".strip(" |") if manual else nota_seed
                elif actual:
                    config.notas = f"{actual} | {nota_seed}"
                else:
                    config.notas = nota_seed

            if datos["retenciones"]:
                config.retenciones.clear()
                for ret in datos["retenciones"]:
                    config.retenciones.append(SiesaProveedorRetencion(**ret))
                total_ret += len(datos["retenciones"])

        print(f"Proveedores en plan:            {len(plan)}")
        print(f"  configs nuevos:               {creados}")
        print(f"  configs existentes tocados:   {actualizados}")
        print(f"  retenciones cargadas:         {total_ret}")
        print(f"  retenciones manuales previas reemplazadas por ERP: {len(reemplazadas_manual)}")
        for nit in reemplazadas_manual:
            print(f"    - {nit} ({plan[nit]['razon_social']})")

        if dry_run:
            await db.rollback()
            print("\nDRY RUN: no se escribió nada.")
        else:
            await db.commit()
            print("\nCommit OK.")


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Reporta sin escribir")
    parser.add_argument("--dir", default=str(DATA_DIR), help="Carpeta con los CSV del ERP")
    args = parser.parse_args()

    data_dir = Path(args.dir)
    detalle = leer_csv(data_dir / "detalle_retenciones.csv")
    maestra = leer_csv(data_dir / "maestra_proveedores.csv")
    print(f"Detalle: {len(detalle)} filas | Maestra: {len(maestra)} proveedores")

    plan = construir_plan(detalle, maestra)
    usables = sum(1 for d in plan.values() if d["retenciones"])
    print(f"Proveedores con retenciones usables: {usables}")
    print(f"Proveedores solo con notas (pendientes/autoretenedor): {len(plan) - usables}")

    await aplicar(plan, args.dry_run)


if __name__ == "__main__":
    asyncio.run(main())
