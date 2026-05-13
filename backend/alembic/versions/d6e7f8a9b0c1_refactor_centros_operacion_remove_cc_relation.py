"""refactor centros_operacion: quitar relacion CC, agregar codigo, recargar datos

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-05-13 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision = 'd6e7f8a9b0c1'
down_revision = 'c5d6e7f8a9b0'
branch_labels = None
depends_on = None


CENTROS_DATA = [
    ('025', 'CAFE QUINDIO EXPRESS EVENTOS'),
    ('030', 'CAFE QUINDIO EXPRESS PLAZA CENTRAL'),
    ('028', 'CAFE QUINDIO EXPRESS MALL PLAZA'),
    ('001', 'FABRICA'),
    ('019', 'CAFE QUINDIO EXPRESS EDIFICIO BD-BACATA'),
    ('002', 'CAFE QUINDIO EXPRESS PORTAL DEL QUINDÍO'),
    ('003', 'CAFE QUINDIO EXPRESS UNICENTRO ARMENIA'),
    ('004', 'CAFE QUINDIO EXPRESS PARQUE SUCRE'),
    ('005', 'CAFE QUINDIO EXPRESS CLINICA CENTRAL'),
    ('006', 'CAFE QUINDIO EXPRESS C.C. IBG'),
    ('007', 'CAFE QUINDIO EXPRESS CENTRO CONVENCIONES'),
    ('008', 'CAFE QUINDIO EXPRESS AEROPUERTO EL EDEN'),
    ('009', 'CAFE QUINDIO EXPRESS PANACA'),
    ('010', 'CAFE QUINDIO EXPRESS CAU FILANDIA'),
    ('011', 'CAFE QUINDIO EXPRESS PARQUE ARBOLEDA'),
    ('012', 'CAFE QUINDIO EXPRESS C.C.FUNDADORES'),
    ('013', 'CAFE QUINDIO EXPRESS CASA FISCAL'),
    ('014', 'CAFE QUINDIO EXPRESS AEROPUERTO DORADO'),
    ('015', 'CAFE QUINDIO EXPRESS C.C UNICENTRO TUNJA'),
    ('040', 'RESTAURANTE CAFE QUINDIO GOURMET'),
    ('050', 'TIENDA C.C. SANTAFE FRANQUICIA'),
    ('018', 'CAFE QUINDIO EXPRESS UNICENTRO 2 ARMENIA'),
    ('029', 'CAFE QUINDIO EXPRESS C.C VIVE TUNJA'),
    ('035', 'CAFE QUINDIO EXPRES SERREZUELA CARTAGENA'),
    ('036', 'CAFE QUINDIO EXPRES FILANDIA'),
    ('037', 'CAFE QUINDIO EXPRESS PLAZA CLARO BOGOTA'),
    ('109', 'BARRANQUILLA'),
    ('032', 'CAFE QUINDIO EXPR. PLAZA BOLIVAR BOGOTA'),
    ('033', 'CAFE QUINDIO BOGOTA'),
    ('031', 'CAFE QUINDIO EXPRESS JARDIN PLAZA CALI'),
    ('034', 'CAFE QUINDIO ARBOLEDA2'),
    ('039', 'CAFE QUINDIO EXPRESS TAMBO EL EDEN'),
    ('108', 'CARTAGENA'),
    ('046', 'CAFE QUINDIO EXPRESS CERRITOS PEREIRA'),
    ('047', 'CAFE QUINDIO EXPRESS OFIC BAVARIA'),
    ('053', 'CAFE QUINDIO EXPRESS UNICENTRO PEREIRA'),
    ('200', 'EXPORTACIONES'),
    ('090', 'ESCUELA DE CAFE'),
    ('199', 'RESTO DEL PAIS'),
    ('107', 'ANTIOQUIA'),
    ('106', 'BOYACA'),
    ('105', 'CUNDINAMARCA'),
    ('104', 'VALLE'),
    ('103', 'CALDAS'),
    ('102', 'RISARALDA'),
    ('101', 'QUINDIO'),
    ('024', 'CAFE QUINDIO EXPRESS MERCEDES BENZ'),
    ('049', 'CAFE QUINDIO EXPRESS BUENAVISTA BARRANQ'),
    ('051', 'CAFE QUINDIO EXPRES BOCAGRANDE CARTAGENA'),
    ('022', 'CAFE QUINDIO EXPRESS MALL PARAISO ARM.'),
    ('017', 'PANACA MUNDO DEL CABALLO'),
    ('016', 'CAFE QUINDIO EXPRESS SALENTO'),
    ('026', 'CAFE QUINDIO EXPRESS USAQUEN'),
    ('027', 'CAFE QUINDIO EXPRESS'),
    ('020', 'CAFE QUINDIO EXPRESS CC PACIFIC MALL'),
    ('021', 'CAFE QUINDIO EXPRESS NOGALES BOGOTA'),
    ('023', 'BARRANQUERO'),
    ('044', 'CAFE QUINDIO EXPRESS EL RETIRO'),
    ('045', 'CAFE QUINDIO ARABIA'),
    ('140', 'AUDITORIA INTERNA'),
    ('166', 'VENTAS PEREIRA'),
    ('167', 'VENTAS QUINDIO 1'),
    ('168', 'VENTAS QUINDIO 2'),
    ('169', 'VENTAS QUINDIO 3'),
    ('170', 'VENTAS SANTANDER'),
    ('171', 'VENTAS VIP'),
    ('110', 'BUCARAMANGA'),
    ('038', 'CAFE QUINDIO EXPRES SERREZUELA 2'),
    ('163', 'VENTAS CARTAGENA'),
    ('164', 'VENTAS MANIZALES'),
    ('165', 'VENTAS MEDELLIN'),
    ('150', 'AREA COMERCIAL'),
    ('151', 'DIRECTOR VENTAS BOGOTA'),
    ('152', 'DIRECTOR VENTAS SUR OCCIDENTE'),
    ('153', 'VENTAS TUNJA - DRA PATRICIA'),
    ('154', 'CLIENTES NACIONALES'),
    ('156', 'EVENTOS COMERCIALES'),
    ('070', 'CAFE QUINDIO PLAZA BOCAGRANDE'),
    ('122', 'MAQUILA PRICESMART'),
    ('124', 'TIENDA VIRTUAL'),
    ('116', 'MAQUILA BRITT'),
    ('048', 'CAFE QUINDIO EXPRESS AEROPUERTO MATECAÑA'),
    ('052', 'CAFE QUINDIO EXPRESS FABRICA SAN PEDRO'),
    ('155', 'VENDEDOR GERENCIA COMERCIAL'),
    ('157', 'VENTAS BOGOTA'),
    ('158', 'VENTAS BOGOTA 1'),
    ('159', 'VENTAS BOGOTA 2'),
    ('160', 'VENTAS BOGOTA 3'),
    ('161', 'VENTAS BOYACA'),
    ('162', 'VENTAS CALI'),
    ('231', 'CALIDAD CAFE'),
    ('183', 'SIG'),
    ('184', 'MANTENIMIENTO'),
    ('227', 'NO USAR MERCADEO'),
    ('180', 'GERENCIA ADMINISTRATIVA'),
    ('059', 'CAFE QUINDIO EXPRESS FLORIDA GARDEN'),
    ('181', 'TALENTO HUMANO'),
    ('182', 'TIC'),
    ('190', 'GERENCIA FINANCIERA'),
    ('191', 'CONTABILIDAD'),
    ('192', 'TESORERIA'),
    ('193', 'CARTERA'),
    ('194', 'COMPRAS'),
    ('210', 'PRESIDENCIA'),
    ('058', 'CAFE QUINDIO EXPRESS GRANADA CALI'),
    ('067', 'CAFE QUINDIO EXPRESS CENCO LIMONAR'),
    ('068', 'CAFE QUINDIO EXPRESS CARIBE'),
    ('221', 'GERENCIA GENERAL'),
    ('071', 'CAFE QUINDIO EXPRESS UNICENTRO BOGOTA'),
    ('241', 'CONTROL CALIDAD'),
    ('069', 'CAFE QUINDIO EXPRESS TORRE 90'),
    ('072', 'CAFE QUINDIO EXPRESS SAN NICOLAS'),
    ('078', 'CAFE QUINDIO PZA AMERICA-PLAZA ESTRELLA'),
    ('079', 'CAFE QUINDIO EXPRESS VIVA ENVIGADO'),
    ('080', 'CAFE QUINDIO EXPRESS MALOKA'),
    ('081', 'CAFE QUINDIO C COMERCIAL NUESTRO BOGOTA'),
    ('082', 'CAFE QUINDIO CENTRO COMERCIAL EL EDEN'),
    ('222', 'GERENCIA MERCADEO'),
    ('223', 'GERENCIA INNOVACION'),
    ('224', 'GERENCIA OPERACIONES'),
    ('225', 'PUBLICIDAD'),
    ('226', 'ARQUITECTURA'),
    ('228', 'SERVICIOS GENERALES'),
    ('229', 'IMPUESTOS'),
    ('060', 'CAFE QUINDIO EXPRESS BUENAVISTA 2'),
    ('061', 'CAFE QUINDIO EXPRESS IMPERIAL BOGOTA'),
    ('185', 'BIENESTAR RECURSO HUMANO'),
    ('232', 'INNOVACION LANZAMIENTOS'),
    ('233', 'MEDIOS (ATL)'),
    ('234', 'COMUNICACION DIGITAL (POSICIONAMIENTO)'),
    ('235', 'PR (EVENTOS E INFLUENCER)'),
    ('236', 'EVENTOS (BTL)'),
    ('203', 'CEDI FASE 2'),
    ('230', 'LOGISTICA'),
    ('240', 'INNOVACION MERCADEO'),
    ('041', 'TIENDA SMIRNOFF'),
    ('056', 'CAFE QUINDIO EXPRESS TAMBO LA MANUELA'),
    ('057', 'CAFE QUINDIO EXPRESS TAMBO EL PRIVILEGIO'),
    ('174', 'VENTAS BOGOTA 5'),
    ('175', 'VENTAS BARRANQUILA'),
    ('176', 'VENTAS MEDELLIN 1'),
    ('173', 'VENTAS BOGOTA 4'),
    ('246', 'ENSAMBLES Y SOUVENIRS'),
    ('250', 'PLANTA CAFE MOI'),
    ('064', 'CAFE QUINDIO EXPRESS CERRITOS DE MAR'),
    ('073', 'CAFE QUINDIO PANCE CAÑAVERAL'),
    ('074', 'CAFE QUINDIO EXPRESS UNICENTRO CALI'),
    ('075', 'CAFE QUINDIO CHIPICHAPE'),
    ('076', 'CAFE QUINDIO PLAZA SOL'),
    ('247', 'PLANTA MERENGUES Y GALLETAS MOI'),
    ('077', 'CAFE QUINDIO EXPRESS UNICO OUTLET BAQ'),
    ('248', 'PLANTA AREQUIPE Y MERMELADA MOI'),
    ('100', 'GERENCIA DE TIENDAS'),
    ('063', 'CAFE QUINDIO EXPRESS VIA LA PRIMAVERA'),
    ('065', 'CAFE QUINDIO EXPRESS SANTAFE MED'),
    ('066', 'CAFE QUINDIO EXPRESS ARKADIA'),
    ('300', 'ACTIVOS EN COMODATO'),
    ('054', 'CAFE QUINDIO EXPRESS CC SANTAFE BOGOTA'),
    ('055', 'CAFE QUINDIO EXPRESS TITAN PLAZA'),
    ('209', 'GERENCIA DE EXPANSION'),
    ('062', 'CAFE QUINDIO EXPRESS ILATINA'),
    ('177', 'KAM'),
    ('172', 'AREA TRADE'),
    ('211', 'FINCA SAN PEDRO'),
    ('242', 'PLANTA MERENGUES Y GALLETAS MOD'),
    ('083', 'CAFE QUINDIO ICESI'),
    ('085', 'CAFE QUINDIO MARRIOTT 26'),
    ('084', 'CAFE QUINDIO CENTRO MAYOR'),
    ('086', 'CAFE QUINDIO GASTRO RIO'),
    ('087', 'CAFE QUINDIO FONTANAR'),
    ('092', 'CAFE QUINDIO PLAZA FLORA'),
    ('237', 'PLANEACION'),
    ('239', 'OFICINAS ADMINISTRATIVAS'),
    ('243', 'PLANTA AREQUIPE Y MERMELADA MOD'),
    ('244', 'PLANTA PASTELERIA MOD'),
    ('245', 'PLANTA CAFE MOD'),
    ('249', 'PLANTA PASTELERIA MOI'),
    ('088', 'CAFE QUINDIO NQS'),
    ('042', 'TIENDA RAPPI TURBO'),
    ('251', 'DIRECTOR VENTAS FOOD SERVICE'),
    ('089', 'CAFE QUINDIO LLANOGRANDE'),
    ('093', 'CAFÉ QUINDIO ÚNICO OUTLET CALI'),
]


def upgrade():
    # 1. Hacer nullable las columnas con NOT NULL antes de poner NULL
    op.alter_column('facturas_distribucion_ccco', 'centro_operacion_id', nullable=True)
    op.alter_column('facturas_distribucion_ccco', 'centro_costo_id', nullable=True)

    # 2. Nullificar FKs con política RESTRICT que impiden borrar registros
    op.execute("UPDATE facturas SET centro_operacion_id = NULL")
    op.execute("UPDATE facturas_distribucion_ccco SET centro_operacion_id = NULL")

    # 2. Quitar constraint único que incluye centro_costo_id
    op.drop_constraint('uq_centro_operacion_cc_nombre', 'centros_operacion', type_='unique')

    # 3. Borrar todos los registros existentes
    op.execute("DELETE FROM centros_operacion")

    # 4. Quitar columna centro_costo_id
    op.drop_column('centros_operacion', 'centro_costo_id')

    # 5. Agregar columna codigo (nullable primero para poder insertar)
    op.add_column('centros_operacion', sa.Column('codigo', sa.String(10), nullable=True))

    # 6. Insertar los 182 centros de operación del CSV
    for codigo, nombre in CENTROS_DATA:
        nombre_escaped = nombre.replace("'", "''")
        op.execute(
            f"INSERT INTO centros_operacion (id, codigo, nombre, activo, created_at, updated_at) "
            f"VALUES (gen_random_uuid(), '{codigo}', '{nombre_escaped}', true, NOW(), NOW())"
        )

    # 7. Hacer codigo NOT NULL y agregar constraint único
    op.alter_column('centros_operacion', 'codigo', nullable=False)
    op.create_unique_constraint('uq_centro_operacion_codigo', 'centros_operacion', ['codigo'])


def downgrade():
    op.drop_constraint('uq_centro_operacion_codigo', 'centros_operacion', type_='unique')
    op.drop_column('centros_operacion', 'codigo')
    op.add_column('centros_operacion', sa.Column(
        'centro_costo_id',
        PG_UUID(as_uuid=True),
        sa.ForeignKey('centros_costo.id', ondelete='RESTRICT'),
        nullable=True
    ))
