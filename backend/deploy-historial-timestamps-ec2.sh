#!/bin/bash
# Script para aplicar migración de historial de facturas por área en EC2
# Ejecutar desde: /home/ubuntu/CONTABILIDADCQ/backend

echo "=========================================="
echo "APLICANDO MIGRACIÓN - HISTORIAL FACTURAS"
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

# Verificar versión actual
echo "Versión actual de la base de datos:"
alembic current
echo ""

# Mostrar migraciones pendientes
echo "Migraciones pendientes:"
alembic history | tail -5
echo ""

echo "Esta migración agrega a la tabla facturas:"
echo "  - fecha_envio_contabilidad (TIMESTAMP WITH TIME ZONE, nullable)"
echo "  - fecha_envio_tesoreria    (TIMESTAMP WITH TIME ZONE, nullable)"
echo "  - fecha_cierre             (TIMESTAMP WITH TIME ZONE, nullable)"
echo ""
read -p "¿Aplicar la migración? (si/no): " confirm
if [ "$confirm" != "si" ]; then
    echo "Migración cancelada"
    exit 0
fi

echo ""
echo "Aplicando migración..."
alembic upgrade head

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "[✓] MIGRACIÓN APLICADA EXITOSAMENTE"
    echo "=========================================="
    echo ""
    echo "Nueva versión de la base de datos:"
    alembic current
    echo ""
    echo "Reiniciando servicio backend..."
    sudo systemctl restart contabilidadcq
    echo ""
    echo "Verificando estado del servicio:"
    sudo systemctl status contabilidadcq --no-pager
    echo ""
    echo "Para ver los logs en tiempo real:"
    echo "  sudo journalctl -u backend -f"
    echo ""
else
    echo ""
    echo "=========================================="
    echo "[✗] ERROR AL APLICAR MIGRACIÓN"
    echo "=========================================="
    echo ""
    echo "Revisa los logs para más información"
    exit 1
fi
