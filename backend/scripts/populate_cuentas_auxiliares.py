"""
Script para poblar la tabla cuentas_auxiliares desde el archivo CSV.
Ejecutar: python scripts/populate_cuentas_auxiliares.py
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import async_session_maker
from db.models import CuentaAuxiliar


# Datos extraídos del CSV
CUENTAS_DATA = [
    ("14050101", "MATERIAS PRIMAS"),
    ("14050501", "MATERIAS PRIMAS"),
    ("14100505", "PRODUCTO EN PROCESO MP"),
    ("14100510", "PRODUCTO EN PROCESO MOD"),
    ("14100515", "PRODUCTO EN PROCESO CIF"),
    ("14101005", "PROD. EN PROC ORDENES ABIERTA MP"),
    ("14101010", "PROD. EN PROC ORDENES ABIERTA MOD"),
    ("14101015", "PROD. EN PROC ORDENES ABIERTA CIF"),
    ("14280501", "PLATANO"),
    ("14280502", "PLANTACIONES DE CAFE"),
    ("14301001", "PRODUCTOS TERMINADOS MP"),
    ("14301002", "PRODUCTOS TERMINADOS MOD"),
    ("14301003", "PRODUCTOS TERMINADOS CIF"),
    ("14301004", "INVENTARIO PRODUCTO DEFECTUOSO"),
    ("14350101", "MERCANCIA NO FABRICADA POR LA EMPRESA"),
    ("14350102", "IMPUESTO AL CONSUMO"),
    ("14350103", "BONOS"),
    ("14350104", "UTENSILIOS MUEBLES-ENSERES Y REPUESTOS"),
    ("14350105", "IMPUESTO IBUA BEBIDAS"),
    ("14550101", "DOTACIONES"),
    ("14600101", "EMPAQUES Y EMBALAJES"),
    ("14659001", "MERCANCIA EN TRANSITO"),
    ("14990501", "PUENTE SALDOS INICIALES"),
    ("15040501", "URBANOS"),
    ("15041001", "RURALES"),
    ("15080501", "CONSTRUCCIONES Y EDIFICACIONES"),
    ("15080502", "CONSTRUCCIONES Y EDIFICACIONES FABRICA"),
    ("151201001", "CONSTRUCCIONES Y EDIFICACIONES"),
    ("15120501", "MAQUINARIA Y EQUIPO"),
    ("15160501", "LOCALES"),
    ("15160597", "REVALORIZACION LOCALES"),
    ("15160598", "DETERIORO LOCALES"),
    ("15162001", "FABRICAS Y PLANTAS INDUSTRIALES"),
    ("15162097", "REVALORIZACION FABRICA"),
    ("15162098", "DETERIORO FABRICA"),
    ("15200102", "MAQUINARIA Y EQUIPO EN COMODATO"),
    ("15200103", "MAQUINARIA Y EQUIPO ADQUIRIDA EN LEASING"),
    ("15200197", "REVALORIZACION MAQUINARIA Y EQUIPO"),
    ("15200198", "DETERIORO MAQUINARIA Y EQUIPO"),
    ("15200199", "IVA EN ACTIVOS FIJOS"),
    ("15280501", "EQUIPO DE PROCESAMIENTO DE DATOS"),
    ("15280597", "REVALORIZACION  EQUIP PROCES. DATOS"),
    ("15280598", "DETERIORO EQUIP PROCES. DATOS"),
    ("15280599", "IVA EN ACTIVOS FIJOS"),
    ("15281001", "EQUIPO DE TELECOMUNICACIONES"),
    ("15281097", "REVALORIZACION EQUIP TELECOMUNICACIONES"),
    ("15281098", "DETERIORO EQUIP TELECOMUNICACIONES"),
    ("15281099", "IVA EN ACTIVOS FIJOS"),
    ("15400501", "FLOTA Y EQUIPO DE TRANSPORTE"),
    ("15400597", "REVALORIZACION FLOTA Y EQUIPO DE TRANSP."),
    ("15400598", "DETERIORO FLOTA Y EQUIPO DE TRANSP."),
    ("15400599", "IVA EN ACTIVOS FIJOS"),
    ("15640501", "CULTIVOS EN DESARROLLO"),
    ("15640502", "CULTIVOS EN DESARROLLO - INSUMOS"),
    ("15640503", "CULTIVOS EN DESARROLLO-COMPRA HERRAMIEN."),
    ("15640504", "CULTIVOS EN DESARROLLO - TRABAJADORES"),
    ("156499", "CULTIVOS EN DESARROLLO - OTROS"),
    ("15880501", "MAQUINARIA Y EQUIPO"),
    ("15881001", "EQUIPO DE OFICINA"),
    ("15881501", "EQUIPO DE COMPUTACION Y COMUNICACION"),
    ("15881501-1", "EQUIPO COMPUTACION YCOMUNICACION SIN IVA"),
    ("15883001", "FLOTA Y EQUIPO DE TRANSPORTE"),
    ("15887001", "CONSTRUCCIONES Y EDIFICACIONES"),
    ("15920501", "CONSTRUCCIONES Y  EDIFICACIONES"),
    ("15921001", "MAQUINARIA Y EQUIPO"),
    ("15921501", "EQUIPO DE OFICINA"),
    ("15922001", "EQUIPO DE COMPUTACION Y COMUNICACION"),
    ("15923501", "FLOTA Y EQUIPO DE TRANSPORTE"),
    ("15990801", "URBANOS"),
    ("15991601", "CONSTRUCCIONES Y EDIFICACIONES"),
    ("15992001", "MAQUINARIA Y EQUIPO"),
    ("15992801", "EQUIPO DE COMPUTACION Y COMUNICACION"),
    ("15994001", "FLOTA Y EQUIPO DE TRANSPORTE"),
    ("16350101", "LICENCIA INVIMA"),
    ("16350201", "LICENCIA SIESA"),
    ("17052001", "SEGUROS Y FIANZAS"),
    ("17059501", "GASTOS PAGADOS POR ANTICIPADO"),
    ("17100801", "MEJORA A PROPIEDAD AJENA T. NUEVAS"),
    ("17102801", "CONSTRIBUCIONES Y AFILIACIONES"),
    ("17103201", "CAPACITACION DE PERSONAL"),
    ("17104001", "LICENCIAS"),
    ("17104401", "PUBLICIDAD, PROPAGANDA Y PROMOCION"),
    ("17106001", "DOTACION Y SUMINISTRO A TRABAJADORES"),
    ("17109501", "OTROS"),
    ("17109502", "CANON VARIABLE - LOCALES"),
    ("17109503", "ENERGIA"),
    ("18959501", "IVA RETENIDO EN VENTAS"),
    ("19100801", "CONSTRUCCIONES Y EDIFICACIONES"),
    ("19101201", "MAQUINARIA Y EQUIPO"),
    ("19101601", "EQUIPO DE OFICINA"),
    ("19102001", "EQUIPO DE COMPUTACION Y COMUNICACION"),
    ("19103201", "FLOTA Y EQUIPO DE TRANSPORTE"),
    ("23300101", "ORDENES DE COMPRA POR UTILIZAR"),
    ("23351501", "LIBROS, SUSCRIP, PERIODICOS Y REVISTAS"),
    ("23352001", "COMISIONES"),
    ("23352501", "HONORARIOS"),
    ("23353001", "SERVICIOS TECNICOS"),
    ("23353501", "SERVICIOS DE MANTENIMIENTO"),
    ("23354001", "ARRENDAMIENTO"),
    ("23354501", "TRANSPORTES, FLETES Y ACARREOS"),
    ("23355001", "SERVICIOS PUBLICOS"),
    ("23355501", "SEGUROS"),
    ("23359501", "OTROS"),
    ("23359502", "CUENTA PUENTE CONCILIACION BANCOS"),
    ("23359503", "OTROS DEL EXTERIOR"),
    ("23359599", "NIIF - AJUSTE ACREEDORES DEL EXTERIOR"),
]

# NOTE: This is part 1 of the data. The script will be continued in a comment
# Total accounts from CSV: 853 rows

async def populate_cuentas():
    """Pobla la tabla cuentas_auxiliares con los datos del CSV."""
    async with async_session_maker() as session:
        try:
            print(f"Insertando {len(CUENTAS_DATA)} cuentas auxiliares...")
            
            for codigo, descripcion in CUENTAS_DATA:
                cuenta = CuentaAuxiliar(
                    codigo=codigo,
                    descripcion=descripcion,
                    activa=True
                )
                session.add(cuenta)
            
            await session.commit()
            print(f"✅ Se insertaron {len(CUENTAS_DATA)} cuentas auxiliares exitosamente")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error al insertar cuentas: {e}")
            raise


if __name__ == "__main__":
    print("Script de población de cuentas auxiliares")
    print("=" * 50)
    print(f"NOTA: Este script contiene solo {len(CUENTAS_DATA)} de 853 cuentas.")
    print("Se recomienda usar el archivo create_cuentas_auxiliares.sql")
    print("o completar el script con todas las cuentas del CSV.")
    print("=" * 50)
    
    asyncio.run(populate_cuentas())
