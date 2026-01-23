#!/bin/bash
# Script para aplicar migraciones del modulo Carpetas en EC2
# Ejecutar desde: /home/ubuntu/CONTABILIDADCQ/backend

echo "=========================================="
echo "APLICANDO MIGRACIONES - MODULO CARPETAS"
echo "=========================================="
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "alembic.ini" ]; then
    echo "ERROR: No se encuentra alembic.ini"
    echo "Ejecuta este script desde el directorio backend"
    exit 1
fi

# Activar entorno virtual si existe
if [ -d "venv" ]; then
    echo "Activando entorno virtual..."
    source venv/bin/activate
elif [ -d "../venv" ]; then
    echo "Activando entorno virtual..."
    source ../venv/bin/activate
fi

# Verificar version actual
echo "Version actual de la base de datos:"
alembic current
echo ""

# Mostrar migraciones pendientes
echo "Migraciones pendientes:"
alembic history --verbose | grep -A 2 "carpetas"
echo ""

# Confirmar antes de aplicar
read -p "Aplicar las 4 migraciones de carpetas? (si/no): " confirm
if [ "$confirm" != "si" ]; then
    echo "Migraciones canceladas"
    exit 0
fi

echo ""
echo "Aplicando migraciones..."
alembic upgrade head

if [ $? -eq 0 ]; then
    echo ""
    echo "[OK] Migraciones aplicadas exitosamente"
    echo ""
    echo "Nueva version:"
    alembic current
    echo ""
    echo "Verificando tabla carpetas..."
    echo "SELECT COUNT(*) FROM carpetas;" | psql $DATABASE_URL
    echo ""
    echo "[SUCCESS] Despliegue de migraciones completado!"
else
    echo ""
    echo "[ERROR] Error al aplicar migraciones"
    exit 1
fi
