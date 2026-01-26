-- Script para crear y poblar tabla unidades_negocio
-- Ejecutar en PostgreSQL local

-- 1. Crear la tabla
CREATE TABLE IF NOT EXISTS unidades_negocio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(10) NOT NULL UNIQUE,
    descripcion TEXT NOT NULL,
    activa BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Crear índices
CREATE INDEX IF NOT EXISTS ix_unidades_negocio_codigo ON unidades_negocio(codigo);
CREATE INDEX IF NOT EXISTS ix_unidades_negocio_descripcion ON unidades_negocio(descripcion);

-- 3. Insertar datos
INSERT INTO unidades_negocio (codigo, descripcion) VALUES
('01', 'CAFE CONSUMO'),
('02', 'CAFE GOURMET'),
('03', 'CAFE ESPECIAL DE ORIGEN'),
('04', 'CAFE INSTANTANEO'),
('05', 'GALLETAS CAFECITAS'),
('06', 'MERENGUES'),
('07', 'AREQUIPE'),
('08', 'MERMELADA'),
('09', 'CHOCOFFES'),
('10', 'GALLETAS DE AVENA'),
('11', 'PASTELERIA'),
('12', 'SOUVENIRS'),
('13', 'TIENDAS DE CAFE'),
('14', 'RESTAURANTE'),
('15', 'EXPORTACIONES'),
('16', 'MAQUILA BRITT'),
('17', 'CAFE ORGANICO'),
('18', 'ESCUELA DE CAFE'),
('19', 'VENTAS NACIONALES'),
('20', 'CAFE COSECHA ESPECIAL'),
('21', 'CAPSULAS DE CAFE'),
('22', 'MAQUILA PRICE SMART'),
('23', 'MAQUINAS'),
('24', 'TIENDA VIRTUAL'),
('25', 'DULCES CARAMELO'),
('26', 'FINCA SAN PEDRO'),
('27', 'CAFE PACAMARA'),
('28', 'CONSTRUCCION FABRICA'),
('29', 'CAFE SUBASTADO'),
('30', 'CAFE PROCESOS'),
('31', 'CAFE VARIETALES'),
('32', 'MAQUILA PENON'),
('33', 'AUDITORIA INTERNA'),
('34', 'MAQUILA CAPSULAS'),
('35', 'BARRANQUERO'),
('36', 'TIENDA ARABIA'),
('37', 'CAFE VERDE'),
('38', 'CAFE DESCAFEINADO'),
('39', 'PRESIDENCIA'),
('40', 'G.GENERAL'),
('41', 'G.ADMINISTRATIVA'),
('42', 'G.FINANCIERA'),
('43', 'G.MERCADEO'),
('44', 'G.INNOVACION'),
('45', 'G.OPERATIVA'),
('46', 'CONSTRUCCION CEDI FASE 2'),
('47', 'CALIDAD CAFE'),
('48', 'G.EXPANSION'),
('49', 'LOGISTICA'),
('50', 'MANTENIMIENTO'),
('51', 'TIC'),
('52', 'GESTION HUMANA'),
('53', 'CONTROL CALIDAD'),
('54', 'BIENESTAR'),
('55', 'SIG'),
('56', 'CAFE BLEND TRADICION'),
('57', 'ARQUITECTURA'),
('58', 'COMPRAS'),
('99', 'GENERAL')
ON CONFLICT (codigo) DO NOTHING;

-- 4. Actualizar la versión de alembic
INSERT INTO alembic_version (version_num) VALUES ('3097f1a3d41d')
ON CONFLICT (version_num) DO NOTHING;

-- 5. Verificar
SELECT COUNT(*) as total_unidades FROM unidades_negocio;
SELECT codigo, descripcion FROM unidades_negocio ORDER BY codigo LIMIT 10;
