#!/bin/bash
# Script para aplicar migraciones de cambio de contraseña obligatorio en EC2
# Ejecutar desde: /home/ubuntu/CONTABILIDADCQ/backend

echo "=========================================="
echo "MIGRACION: Cambio de Contraseña Obligatorio"
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
echo "Migraciones que se aplicarán:"
echo "  - add_must_change_password_to_users (cec6c1ea50ab)"
echo ""

# Confirmar antes de aplicar
read -p "¿Deseas aplicar esta migración? (si/no): " confirm
if [ "$confirm" != "si" ]; then
    echo "Migracion cancelada"
    exit 0
fi

echo ""
echo "Aplicando migración..."
alembic upgrade head

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Migración aplicada exitosamente"
    echo ""
    echo "Nueva version:"
    alembic current
    echo ""
    echo "Verificando columna must_change_password..."
    psql $DATABASE_URL -c "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'must_change_password';"
    echo ""
    echo "Contando usuarios que deben cambiar contraseña:"
    psql $DATABASE_URL -c "SELECT COUNT(*) as total_must_change FROM users WHERE must_change_password = true;"
    echo ""
    echo "✓ Despliegue de migración completado!"
    echo ""
    echo "NOTA: Todos los usuarios existentes tendrán must_change_password = true por defecto."
    echo "      Deberán cambiar su contraseña en el próximo login."
else
    echo ""
    echo "✗ Error al aplicar migración"
    exit 1
fi
