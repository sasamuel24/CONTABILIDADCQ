#!/bin/bash
# =============================================================================
# MIGRACIÓN TOTAL MÓDULO GASTOS — producción EC2/RDS
# Migración: e0f1a2b3c4d5_gastos_total_migracion_produccion
#
# Es IDEMPOTENTE: usa IF NOT EXISTS en todo, se puede ejecutar
# aunque algunas partes ya estén aplicadas.
#
# Cambios que aplica:
#   1. paquetes_gastos:   quita unique(user_id, semana)
#   2. paquetes_gastos:   agrega columna folio (PKG-YYYY-NNNNN) + retroactivo
#   3. paquetes_gastos:   agrega columna monto_a_pagar
#   4. tokens_aprobacion_paquetes: crea la tabla (aprobación por email)
#   5. comentarios_paquete: actualiza check constraint (agrega 'devolucion_gasto')
#   6. gastos_legalizacion: agrega estado_gasto, motivo_devolucion_gasto,
#                           devuelto_por_user_id, fecha_devolucion_gasto
#
# Ejecutar desde: /home/ubuntu/CONTABILIDADCQ/backend
# =============================================================================

echo "=========================================="
echo "MIGRACIÓN TOTAL - MÓDULO GASTOS"
echo "e0f1a2b3c4d5"
echo "=========================================="
echo ""

if [ ! -f "alembic.ini" ]; then
    echo "ERROR: No se encuentra alembic.ini"
    echo "Ejecuta este script desde el directorio /home/ubuntu/CONTABILIDADCQ/backend"
    exit 1
fi

# Activar entorno virtual
if [ -d "venv" ]; then
    echo "Activando entorno virtual..."
    source venv/bin/activate
elif [ -d "../venv" ]; then
    source ../venv/bin/activate
fi

echo "Versión actual de la base de datos:"
alembic current
echo ""

echo "Cambios que se aplicarán (idempotentes):"
echo "  [1] paquetes_gastos    — quitar unique user_id+semana"
echo "  [2] paquetes_gastos    — columna folio + folios retroactivos"
echo "  [3] paquetes_gastos    — columna monto_a_pagar"
echo "  [4] tokens_aprobacion_paquetes — crear tabla"
echo "  [5] comentarios_paquete        — check constraint actualizado"
echo "  [6] gastos_legalizacion        — estado_gasto, motivo, devuelto_por, fecha"
echo ""

read -p "¿Aplicar migración? (si/no): " confirm
if [ "$confirm" != "si" ]; then
    echo "Migración cancelada."
    exit 0
fi

echo ""
echo "Aplicando migración..."
alembic upgrade e0f1a2b3c4d5

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "[✓] MIGRACIÓN APLICADA EXITOSAMENTE"
    echo "=========================================="
    echo ""
    echo "Nueva versión:"
    alembic current
    echo ""
    echo "Pasos siguientes:"
    echo "  1. Reiniciar backend: sudo systemctl restart backend"
    echo "  2. Verificar logs:    sudo journalctl -u backend -f"
    echo ""
else
    echo ""
    echo "=========================================="
    echo "[✗] ERROR AL APLICAR MIGRACIÓN"
    echo "=========================================="
    echo "Revisa el error arriba."
    echo "Usa 'alembic current' para ver el estado actual."
    exit 1
fi
