#!/bin/bash
# Script para aplicar migracion del modulo Comentarios en EC2
# Ejecutar desde: /home/ubuntu/CONTABILIDADCQ/backend

echo "=========================================="
echo "APLICANDO MIGRACIÓN - MÓDULO COMENTARIOS"
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
echo "Versión actual de la base de datos:"
alembic current
echo ""

# Mostrar migraciones pendientes
echo "Migraciones pendientes:"
alembic history | tail -5
echo ""

# Confirmar antes de aplicar
echo "Esta migración creará:"
echo "  - Tabla: comentarios_factura"
echo "  - Campos: id, factura_id, user_id, contenido, created_at, updated_at"
echo "  - Relación con facturas y usuarios"
echo ""
read -p "¿Aplicar la migración de comentarios? (si/no): " confirm
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
    echo "Verificando tabla creada..."
    echo ""
    
    # Mostrar nueva version
    echo "Nueva versión de la base de datos:"
    alembic current
    echo ""
    
    echo "Siguiente paso:"
    echo "  1. Reiniciar el servicio backend: sudo systemctl restart backend"
    echo "  2. Verificar logs: sudo journalctl -u backend -f"
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
