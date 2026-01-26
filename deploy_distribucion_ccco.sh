#!/bin/bash
# Script de deployment para Distribucion CC/CO
# Ejecutar DESDE EC2: bash deploy_distribucion_ccco.sh

set -e  # Salir si hay error

echo "================================================"
echo "DEPLOYMENT: Distribución CC/CO con Porcentajes"
echo "Ejecutando desde: EC2"
echo "================================================"
echo ""

# Variables
REMOTE_PATH="/home/ubuntu/app"
DB_HOST="contabilidadcq.cfjkmqcfgzar.us-east-2.rds.amazonaws.com"
DB_USER="postgres"
DB_NAME="contabilidadcq"
DB_PASSWORD="C0ntabilidad2024!"

echo "[PASO 1] Actualizar código desde GitHub"
cd $REMOTE_PATH
git pull origin main
echo "[OK] Código actualizado"
echo ""

echo "[PASO 2] Aplicar migración (Distribución CC/CO)"
cd $REMOTE_PATH/backend
source venv/bin/activate

echo "[INFO] Versión actual de Alembic:"
alembic current

echo ""
echo "[INFO] Aplicando migración..."
echo "  - 4f0c53a64cc0: create_facturas_distribucion_ccco_table"
alembic upgrade head

echo ""
echo "[OK] Nueva versión:"
alembic current

deactivate
echo ""

echo "[PASO 3] Verificar estructura de tabla"
echo "[INFO] Consultando tabla facturas_distribucion_ccco..."
PGPASSWORD="$DB_PASSWORD" psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\d facturas_distribucion_ccco"

echo ""
echo "[INFO] Verificando índices:"
PGPASSWORD="$DB_PASSWORD" psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT indexname FROM pg_indexes WHERE tablename = 'facturas_distribucion_ccco';"

echo ""
echo "[INFO] Verificando constraints:"
PGPASSWORD="$DB_PASSWORD" psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT con.conname, pg_get_constraintdef(con.oid) FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid WHERE rel.relname = 'facturas_distribucion_ccco';"

echo ""

echo "[PASO 4] Reiniciar servicio backend"
sudo systemctl restart contabilidad-backend
sleep 3
echo "[OK] Backend reiniciado"
sudo systemctl status contabilidad-backend --no-pager | grep Active
echo ""

echo "[PASO 5] Actualizar frontend"
cd $REMOTE_PATH/frontend
npm install
npm run build

echo "[INFO] Copiando build a nginx..."
sudo cp -r dist/* /var/www/contabilidadcq/

echo "[INFO] Reiniciando nginx..."
sudo systemctl restart nginx
echo "[OK] Frontend actualizado"
echo ""

echo "[PASO 6] Verificación final"
echo "========================"
echo ""
echo "[INFO] Estado Backend:"
sudo systemctl status contabilidad-backend --no-pager | grep Active
echo ""
echo "[INFO] Estado Nginx:"
sudo systemctl status nginx --no-pager | grep Active
echo ""
echo "[INFO] Conteo de distribuciones en BD:"
PGPASSWORD="$DB_PASSWORD" psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) as total_distribuciones FROM facturas_distribucion_ccco;"
echo ""

echo "================================================"
echo "[SUCCESS] DEPLOYMENT COMPLETADO"
echo "================================================"
echo ""
echo "Resumen de cambios:"
echo "  [OK] Migración: 4f0c53a64cc0 create_facturas_distribucion_ccco_table"
echo "  [OK] Tabla: facturas_distribucion_ccco (9 columnas)"
echo "  [OK] Constraints: CHECK porcentaje, 5 FKs (CASCADE/RESTRICT)"
echo "  [OK] Índices: 5 índices creados"
echo "  [OK] Backend: Módulo distribucion_ccco desplegado"
echo "  [OK] Endpoints: GET/PUT/DELETE /facturas/{id}/distribucion-ccco"
echo "  [OK] Frontend: DistribucionCCCOTable component"
echo "  [OK] UI: Integrado en Responsable/Contabilidad/Tesorería"
echo "  [OK] Validación: Porcentajes deben sumar 100%"
echo "  [OK] Servicios reiniciados"
echo ""
echo "URL: https://contabilidadcq.com"
echo ""
echo "Endpoints disponibles:"
echo "  - GET    /api/v1/facturas/{factura_id}/distribucion-ccco"
echo "  - PUT    /api/v1/facturas/{factura_id}/distribucion-ccco"
echo "  - DELETE /api/v1/facturas/{factura_id}/distribucion-ccco"
echo ""
