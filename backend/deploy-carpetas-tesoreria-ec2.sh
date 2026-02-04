#!/bin/bash

##############################################################################
# Script de despliegue de migración: carpetas_tesoreria
# Sistema: CONTABILIDADCQ
# Descripción: Aplica migración de tabla carpetas_tesoreria en producción
##############################################################################

set -e  # Detener en caso de error

echo "=========================================="
echo "DESPLIEGUE DE MIGRACIÓN - CARPETAS TESORERÍA"
echo "=========================================="
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar que estamos en el directorio correcto
if [ ! -f "alembic.ini" ]; then
    echo -e "${RED}ERROR: No se encuentra alembic.ini${NC}"
    echo "Asegúrate de estar en el directorio backend/"
    exit 1
fi

echo -e "${YELLOW}📋 INFORMACIÓN DE LA MIGRACIÓN:${NC}"
echo "  - Tabla nueva: carpetas_tesoreria"
echo "  - Columna nueva en facturas: carpeta_tesoreria_id"
echo "  - Índices: 4 índices nuevos"
echo "  - Relaciones: FK con facturas, users, self-reference"
echo ""

# Mostrar estado actual
echo -e "${YELLOW}📊 Estado actual de migraciones:${NC}"
source venv/bin/activate
alembic current
echo ""

# Mostrar heads disponibles
echo -e "${YELLOW}🔍 Heads disponibles:${NC}"
alembic heads
echo ""

# Pedir confirmación
echo -e "${YELLOW}⚠️  ADVERTENCIA:${NC}"
echo "  Esta migración modificará la base de datos de producción."
echo "  Se creará una nueva tabla y se agregará una columna a facturas."
echo ""
read -p "¿Deseas continuar con la migración? (escribe 'SI' para confirmar): " confirmacion

if [ "$confirmacion" != "SI" ]; then
    echo -e "${RED}❌ Migración cancelada.${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}🚀 Iniciando migración...${NC}"
echo ""

# Hacer backup de la versión actual
echo -e "${YELLOW}💾 Guardando versión actual...${NC}"
CURRENT_VERSION=$(alembic current | grep -oP '^\w+' | head -1)
echo "Versión actual: $CURRENT_VERSION"
echo ""

# Verificar si hay múltiples heads
HEADS_COUNT=$(alembic heads | wc -l)
if [ $HEADS_COUNT -gt 1 ]; then
    echo -e "${YELLOW}⚠️  Se detectaron múltiples heads. Haciendo merge...${NC}"
    alembic merge -m "merge_carpetas_tesoreria_heads" heads
    echo ""
fi

# Ejecutar migración
echo -e "${GREEN}⬆️  Ejecutando: alembic upgrade head${NC}"
alembic upgrade head

# Verificar resultado
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Migración completada exitosamente!${NC}"
    echo ""
    
    # Mostrar nueva versión
    echo -e "${YELLOW}📊 Nueva versión:${NC}"
    alembic current
    echo ""
    
    # Instrucciones para verificar
    echo -e "${GREEN}🔍 VERIFICACIÓN:${NC}"
    echo ""
    echo "Para verificar la migración en la base de datos, ejecuta:"
    echo ""
    echo "  psql -h <RDS_ENDPOINT> -U <DB_USER> -d contabilidad_db"
    echo ""
    echo "Luego ejecuta estas consultas SQL:"
    echo ""
    echo "  -- Ver tabla carpetas_tesoreria"
    echo "  \\dt carpetas_tesoreria"
    echo ""
    echo "  -- Ver estructura completa"
    echo "  \\d carpetas_tesoreria"
    echo ""
    echo "  -- Verificar columna en facturas"
    echo "  SELECT column_name, data_type FROM information_schema.columns"
    echo "  WHERE table_name = 'facturas' AND column_name = 'carpeta_tesoreria_id';"
    echo ""
    echo "  -- Ver índices creados"
    echo "  \\di carpetas_tesoreria*"
    echo ""
    echo -e "${YELLOW}📝 SIGUIENTE PASO:${NC}"
    echo "  Reinicia el servicio backend:"
    echo "  sudo systemctl restart backend"
    echo "  sudo systemctl status backend"
    echo ""
else
    echo ""
    echo -e "${RED}❌ ERROR: La migración falló.${NC}"
    echo ""
    echo "Para revertir (si es necesario):"
    echo "  alembic downgrade $CURRENT_VERSION"
    echo ""
    exit 1
fi

echo "=========================================="
echo "          MIGRACIÓN FINALIZADA"
echo "=========================================="
