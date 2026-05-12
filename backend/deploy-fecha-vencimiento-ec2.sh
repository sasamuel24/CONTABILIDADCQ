#!/bin/bash

##############################################################################
# Script de despliegue de migración: fecha_vencimiento
# Sistema: CONTABILIDADCQ
# Descripción: Agrega campo fecha_vencimiento a tabla facturas
##############################################################################

set -e  # Detener en caso de error

echo "=========================================="
echo "DESPLIEGUE DE MIGRACIÓN - FECHA VENCIMIENTO"
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
echo "  - Revisión: a1b2c3d4e5f6"
echo "  - Columna nueva: fecha_vencimiento (DATE, nullable)"
echo "  - Tabla afectada: facturas"
echo "  - Tipo de operación: ALTER TABLE ADD COLUMN"
echo ""

# Activar entorno virtual si existe
if [ -d "venv" ]; then
    echo "Activando entorno virtual..."
    source venv/bin/activate
elif [ -d "../venv" ]; then
    echo "Activando entorno virtual desde directorio padre..."
    source ../venv/bin/activate
fi

# Mostrar estado actual
echo -e "${YELLOW}📊 Estado actual de migraciones:${NC}"
alembic current
echo ""

# Mostrar heads disponibles
echo -e "${YELLOW}🔍 Heads disponibles:${NC}"
alembic heads
echo ""

# Verificar si hay múltiples heads
HEADS_COUNT=$(alembic heads | wc -l)
if [ $HEADS_COUNT -gt 1 ]; then
    echo -e "${YELLOW}⚠️  ADVERTENCIA: Se detectaron múltiples heads.${NC}"
    echo "Se hará merge automático de las migraciones."
    echo ""
fi

# Pedir confirmación
echo -e "${YELLOW}⚠️  ADVERTENCIA:${NC}"
echo "  Esta migración modificará la base de datos de producción."
echo "  Se agregará la columna 'fecha_vencimiento' a la tabla facturas."
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

# Hacer merge si hay múltiples heads
if [ $HEADS_COUNT -gt 1 ]; then
    echo -e "${YELLOW}🔀 Haciendo merge de heads...${NC}"
    alembic merge heads -m "merge_fecha_vencimiento_$(date +%Y%m%d)"
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Merge completado${NC}"
        echo ""
    else
        echo -e "${RED}❌ Error al hacer merge${NC}"
        exit 1
    fi
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
    echo "Luego ejecuta esta consulta SQL:"
    echo ""
    echo "  SELECT column_name, data_type, is_nullable"
    echo "  FROM information_schema.columns"
    echo "  WHERE table_name = 'facturas'"
    echo "  AND column_name = 'fecha_vencimiento';"
    echo ""
    echo -e "${GREEN}📝 SIGUIENTE PASO:${NC}"
    echo "  1. Reiniciar el servicio backend: sudo systemctl restart contabilidadcq"
    echo "  2. Verificar logs: sudo journalctl -u backend -f"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Error al ejecutar la migración.${NC}"
    echo ""
    echo -e "${YELLOW}🔄 Para revertir esta migración (si es necesario):${NC}"
    echo "  alembic downgrade -1"
    echo ""
    exit 1
fi

echo -e "${GREEN}=========================================="
echo "MIGRACIÓN COMPLETADA"
echo "==========================================${NC}"
