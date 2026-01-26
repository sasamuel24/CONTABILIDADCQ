#!/bin/bash
# Script de deployment para cuenta auxiliar desde EC2
# Ejecutar: bash deploy_cuentas_auxiliares.sh

set -e  # Salir si hay error

echo "================================================"
echo "DEPLOYMENT: Cuenta Auxiliar + Unidad Negocio"
echo "Destino: RDS desde EC2"
echo "================================================"
echo ""

# Variables
REMOTE_PATH="/home/ubuntu/CONTABILIDADCQ"
DB_HOST="database-1.chgqoo4oaal4.us-east-2.rds.amazonaws.com"
DB_USER="postgres"
DB_NAME="contabilidadcq"
DB_PASSWORD="Samuel22."

echo "[PASO 1] Actualizar codigo desde GitHub"
cd $REMOTE_PATH
git pull origin main
echo "[OK] Codigo actualizado"
echo ""

echo "[PASO 2] Aplicar migraciones (Unidad Negocio + Cuenta Auxiliar)"
cd $REMOTE_PATH/backend
source venv/bin/activate

echo "[INFO] Version actual de Alembic:"
alembic current

echo ""
echo "[INFO] Aplicando migraciones..."
echo "  - 36421a6bfb57: add_unidad_negocio_id_to_facturas"
echo "  - 58b9d320b914: create_cuentas_auxiliares_table"
echo "  - 77b1106498dc: add_cuenta_auxiliar_id_to_facturas"
alembic upgrade head

echo ""
echo "[OK] Nueva version:"
alembic current

deactivate
echo ""

echo "[PASO 3] Insertar 851 cuentas auxiliares"
cd $REMOTE_PATH/backend/scripts
echo "[INFO] Ejecutando SQL con encoding UTF8..."
PGPASSWORD="$DB_PASSWORD" psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SET client_encoding TO 'UTF8';" -f insert_cuentas.sql

echo ""
echo "[INFO] Verificando insercion..."
PGPASSWORD="$DB_PASSWORD" psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) as total_cuentas FROM cuentas_auxiliares;"
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

echo "[PASO 6] Verificacion final"
echo "========================"
echo ""
echo "[INFO] Estado Backend:"
sudo systemctl status contabilidad-backend --no-pager | grep Active
echo ""
echo "[INFO] Estado Nginx:"
sudo systemctl status nginx --no-pager | grep Active
echo ""
echo "[INFO] Datos en base de datos:"
PGPASSWORD="$DB_PASSWORD" psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) as cuentas_auxiliares FROM cuentas_auxiliares; SELECT COUNT(*) as unidades_negocio FROM unidades_negocio;"
echo ""

echo "================================================"
echo "[SUCCESS] DEPLOYMENT COMPLETADO"
echo "================================================"
echo ""
echo "Resumen de cambios:"
echo "  [OK] Migracion: Unidad de Negocio"
echo "  [OK] Migracion: Cuentas Auxiliares tabla"
echo "  [OK] Migracion: FK cuenta_auxiliar_id"
echo "  [OK] 851 cuentas auxiliares insertadas"
echo "  [OK] Modulos API desplegados"
echo "  [OK] Frontend actualizado"
echo "  [OK] Servicios reiniciados"
echo ""
echo "URL: https://contabilidadcq.com"
echo ""
