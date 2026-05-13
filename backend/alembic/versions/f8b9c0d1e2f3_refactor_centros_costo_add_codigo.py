"""refactor centros_costo: agregar codigo, recargar datos del CSV

Revision ID: f8b9c0d1e2f3
Revises: d6e7f8a9b0c1
Create Date: 2026-05-13 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'f8b9c0d1e2f3'
down_revision = 'd6e7f8a9b0c1'
branch_labels = None
depends_on = None


CENTROS_DATA = [
    ('0501', 'GERENCIA GENERAL'),
    ('0502', 'GERENCIA FINANCIERA'),
    ('1001', 'GERENCIA COMERCIAL'),
    ('1101', 'PUBLICIDAD VENTAS'),
    ('1501', 'PLANTA MERENGUES Y GALLETAS MOD'),
    ('1502', 'PLANTA AREQUIPE Y MERMELADA MOD'),
    ('1503', 'PLANTA PASTELERIA MOD'),
    ('1504', 'PLANTA DE CAFE MOD'),
    ('1505', 'ENSAMBLE DE SOUVENIRS'),
    ('1599', 'GENERALES POR DISTRIBUIR'),
    ('1201', 'LOTE No. 11'),
    ('1202', 'LOTE FINCA SAN PEDRO'),
    ('1002', 'PROYECTOS EN DESARROLLO'),
    ('0801', 'GERENCIA DE TIENDAS'),
    ('0503', 'LOGISTICA'),
    ('0901', 'RESTAURANTE'),
    ('0504', 'ALMACEN'),
    ('0505', 'CONTROL DE CALIDAD'),
    ('1598', 'SALDOS INICIALES PRODUCCION'),
    ('1596', 'SALDOS INICIALES ADMON'),
    ('1597', 'SALDOS INICIALES VENTAS'),
    ('1003', 'CONTRATO CEE007-32 BANCOLDEX'),
    ('0802', 'ESCUELA DE CAFE'),
    ('1506', 'PLANTA MERENGUES Y GALLETAS MOI'),
    ('1507', 'PLANTA AREQUIPE Y MERMELADA MOI'),
    ('1508', 'PLANTA PASTELERIA MOI'),
    ('1509', 'PLANTA DE CAFE MOI'),
    ('1301', 'EXPORTACIONES'),
    ('0506', 'TALENTO HUMANO'),
    ('1102', 'PUBLICIDAD TIENDAS'),
    ('0507', 'SISTEMAS'),
    ('1401', 'MAQUILA PRICE SMART'),
    ('0803', 'PUBLICIDAD'),
    ('1004', 'TIENDA VIRTUAL'),
    ('1005', 'DULCES CARAMELO'),
    ('1402', 'MAQUILA BRITT'),
    ('1006', 'GERENCIA DE INNOVACION Y DESARROLLO'),
    ('0508', 'GERENCIA OPERATIVA'),
    ('1403', 'MAQUILA PEÑON'),
    ('1600', 'AUDITORIA INTERNA'),
    ('1404', 'MAQUILA CAPSULAS'),
    ('1007', 'TIENDA ARABIA'),
    ('0509', 'GERENCIA ADMINISTRATIVA'),
    ('1008', 'GERENCIA DE MERCADEO'),
    ('0510', 'CALIDAD CAFE'),
    ('0511', 'PRESIDENCIA'),
    ('0512', 'CEDI FASE 2'),
    ('1009', 'BARRANQUERO'),
    ('0804', 'GERENCIA DE EXPANSION'),
    ('1511', 'GERENCIA OPERATIVA DE PLANTAS'),
    ('0513', 'PLANEACION'),
    ('1512', 'GERENCIA OPERATIVA ADMIN PLANTAS'),
    ('1510', 'PLANEACION MOI'),
]


def upgrade():
    # 1. Nullificar FKs con RESTRICT
    op.execute("UPDATE facturas SET centro_costo_id = NULL")
    op.execute("UPDATE facturas_distribucion_ccco SET centro_costo_id = NULL")

    # 2. Quitar unique constraint en nombre
    op.drop_constraint('uq_centro_costo_nombre', 'centros_costo', type_='unique')

    # 3. Borrar todos los registros
    op.execute("DELETE FROM centros_costo")

    # 4. Agregar columna codigo (nullable primero)
    op.add_column('centros_costo', sa.Column('codigo', sa.String(10), nullable=True))

    # 5. Insertar los 53 centros de costo
    for codigo, nombre in CENTROS_DATA:
        nombre_escaped = nombre.replace("'", "''")
        op.execute(
            f"INSERT INTO centros_costo (id, codigo, nombre, activo, created_at, updated_at) "
            f"VALUES (gen_random_uuid(), '{codigo}', '{nombre_escaped}', true, NOW(), NOW())"
        )

    # 6. Hacer codigo NOT NULL y agregar unique constraint
    op.alter_column('centros_costo', 'codigo', nullable=False)
    op.create_unique_constraint('uq_centros_costo_codigo', 'centros_costo', ['codigo'])


def downgrade():
    op.drop_constraint('uq_centros_costo_codigo', 'centros_costo', type_='unique')
    op.drop_column('centros_costo', 'codigo')
    op.create_unique_constraint('uq_centro_costo_nombre', 'centros_costo', ['nombre'])
