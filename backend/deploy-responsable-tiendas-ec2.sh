#!/bin/bash
# =============================================================================
# DESPLIEGUE: perfil "Responsable de Tiendas" — producción EC2/Aurora
#
# Aplica la migración k5f6a7b8c9d0 (areas.es_tienda + rol responsable_tiendas)
# y crea el usuario. Idempotente: se puede ejecutar varias veces sin duplicar.
#
# Ejecutar desde: /home/ubuntu/CONTABILIDADCQ/backend
# Uso:
#   RT_EMAIL=tiendas@cafequindio.com RT_PASSWORD='TuClaveFuerte#2026' \
#     bash deploy-responsable-tiendas-ec2.sh
# =============================================================================
set -e

echo "=========================================="
echo "  Responsable de Tiendas — despliegue"
echo "=========================================="

# 0. Validaciones básicas
if [ ! -f "alembic.ini" ]; then
    echo "ERROR: ejecuta este script desde /home/ubuntu/CONTABILIDADCQ/backend"
    exit 1
fi

RT_EMAIL="${RT_EMAIL:-tiendas@cafequindio.com}"
if [ -z "$RT_PASSWORD" ]; then
    echo "ERROR: define RT_PASSWORD con una contraseña fuerte. Ej:"
    echo "  RT_EMAIL=$RT_EMAIL RT_PASSWORD='TuClaveFuerte#2026' bash $0"
    exit 1
fi
export RT_EMAIL RT_PASSWORD

# 1. Entorno virtual
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d "../venv" ]; then
    source ../venv/bin/activate
else
    echo "AVISO: no se encontró venv; usando el python del sistema."
fi

# 2. Confirmar que apuntamos a Aurora (no a localhost)
DB_HOST=$(grep '^DATABASE_URL' .env | sed -E 's#.*@([^:/]+).*#\1#')
echo ""
echo "Base de datos destino (host): $DB_HOST"
case "$DB_HOST" in
    localhost|127.0.0.1)
        echo "ERROR: DATABASE_URL apunta a localhost. Aborta: este script es para PRODUCCIÓN (Aurora)."
        exit 1
        ;;
esac
read -p "¿Continuar contra '$DB_HOST'? (si/no): " confirm
[ "$confirm" = "si" ] || { echo "Cancelado."; exit 0; }

# 3. Migración (crea es_tienda + marca tiendas + crea el rol)
echo ""
echo "[1/3] Versión actual de Alembic:"
alembic current
echo "[1/3] Aplicando migraciones (alembic upgrade head)..."
alembic upgrade head
echo "      OK. Versión final:"
alembic current

# 4. Crear el usuario (idempotente)
echo ""
echo "[2/3] Creando usuario Responsable de Tiendas ($RT_EMAIL)..."
python create_responsable_tiendas.py

# 5. Reiniciar backend
echo ""
echo "[3/3] Reiniciando backend (contabilidadcq)..."
sudo systemctl restart contabilidadcq
sleep 2
sudo systemctl status contabilidadcq --no-pager | head -5

echo ""
echo "=========================================="
echo "  LISTO. Usuario: $RT_EMAIL"
echo "  (pedirá cambiar contraseña en el 1er login)"
echo "=========================================="
echo "Recuerda recompilar y desplegar el frontend:"
echo "  cd ../frontend && git pull && npm install && npm run build"
