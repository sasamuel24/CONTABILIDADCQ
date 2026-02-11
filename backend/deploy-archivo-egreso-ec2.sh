#!/bin/bash

# Script de deployment para agregar campo archivo_egreso_url a carpetas_tesoreria
# Ejecutar en servidor EC2

echo "==================================="
echo "Deploy: Archivo Egreso Carpetas"
echo "==================================="
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Directorio del proyecto
PROJECT_DIR="/home/ubuntu/CONTABILIDADCQ"
BACKEND_DIR="$PROJECT_DIR/backend"

# Función para imprimir mensajes
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Verificar que estemos en el directorio correcto
if [ ! -d "$PROJECT_DIR" ]; then
    print_error "Directorio del proyecto no encontrado: $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR" || exit 1
print_success "En directorio: $PROJECT_DIR"
echo ""

# 1. Pull de los últimos cambios
echo "📥 1. Obteniendo últimos cambios del repositorio..."
git stash
git pull origin main
if [ $? -eq 0 ]; then
    print_success "Código actualizado"
else
    print_error "Error al actualizar código"
    exit 1
fi
echo ""

# 2. Activar entorno virtual
echo "🐍 2. Activando entorno virtual..."
cd "$BACKEND_DIR" || exit 1

# Intentar diferentes ubicaciones del entorno virtual
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
    print_success "Entorno virtual activado (.venv)"
elif [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
    print_success "Entorno virtual activado (venv)"
elif [ -f "../venv/bin/activate" ]; then
    source ../venv/bin/activate
    print_success "Entorno virtual activado (../venv)"
else
    print_warning "No se encontró entorno virtual, creando uno nuevo..."
    python3 -m venv .venv
    source .venv/bin/activate
    print_success "Entorno virtual creado y activado"
fi
echo ""

# 3. Instalar/actualizar dependencias (por si acaso)
echo "📦 3. Verificando dependencias..."
pip install --upgrade pip > /dev/null 2>&1
pip install -r requirements.txt > /dev/null 2>&1
print_success "Dependencias verificadas"
echo ""

# 4. Verificar estado de Alembic
echo "🔍 4. Verificando estado de migraciones..."
python -m alembic current
echo ""

# 5. Verificar si hay múltiples heads
echo "🔍 5. Verificando múltiples heads..."
HEADS_COUNT=$(python -m alembic heads | wc -l)
if [ "$HEADS_COUNT" -gt 1 ]; then
    print_warning "Múltiples heads detectados. Creando merge..."
    python -m alembic merge heads -m "merge_archivo_egreso_branch"
    if [ $? -eq 0 ]; then
        print_success "Merge creado exitosamente"
    else
        print_error "Error al crear merge"
        exit 1
    fi
else
    print_success "No hay múltiples heads"
fi
echo ""

# 6. Ejecutar migración
echo "🚀 6. Ejecutando migración add_archivo_egreso_to_carpetas_tesoreria..."
python -m alembic upgrade head
if [ $? -eq 0 ]; then
    print_success "Migración ejecutada exitosamente"
else
    print_error "Error al ejecutar migración"
    exit 1
fi
echo ""

# 7. Verificar que la columna se creó
echo "🔍 7. Verificando columna en base de datos..."
pip install psycopg2-binary > /dev/null 2>&1
python -c "
from sqlalchemy import create_engine, inspect, text
from core.config import settings
import sys

try:
    # Convertir URL async a sync
    db_url = str(settings.database_url).replace('postgresql+asyncpg://', 'postgresql://')
    engine = create_engine(db_url)
    with engine.connect() as conn:
        result = conn.execute(text('''
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'carpetas_tesoreria' 
            AND column_name = 'archivo_egreso_url'
        '''))
        row = result.fetchone()
        if row:
            print(f'✓ Columna archivo_egreso_url encontrada:')
            print(f'  - Tipo: {row[1]}')
            print(f'  - Nullable: {row[2]}')
            sys.exit(0)
        else:
            print('✗ Columna archivo_egreso_url NO encontrada')
            sys.exit(1)
except Exception as e:
    print(f'✗ Error: {e}')
    sys.exit(1)
"
if [ $? -eq 0 ]; then
    print_success "Columna verificada correctamente"
else
    print_error "Error al verificar columna"
    exit 1
fi
echo ""

# 8. Reiniciar servicio backend
echo "🔄 8. Reiniciando servicio backend..."

# Intentar con systemctl primero
if sudo systemctl list-units --all | grep -q "backend.service"; then
    sudo systemctl restart backend
    if [ $? -eq 0 ]; then
        print_success "Servicio backend reiniciado (systemctl)"
    else
        print_error "Error al reiniciar servicio con systemctl"
        exit 1
    fi
else
    # Si no existe el servicio, intentar matar y reiniciar uvicorn
    print_warning "Servicio systemd no encontrado, intentando reiniciar uvicorn manualmente..."
    
    # Matar procesos uvicorn existentes
    pkill -f "uvicorn main:app" 2>/dev/null
    sleep 2
    
    # Reiniciar uvicorn en background
    nohup uvicorn main:app --host 0.0.0.0 --port 8000 > /dev/null 2>&1 &
    sleep 3
    
    # Verificar que el proceso está corriendo
    if pgrep -f "uvicorn main:app" > /dev/null; then
        print_success "Proceso uvicorn reiniciado manualmente"
    else
        print_error "No se pudo reiniciar uvicorn"
        print_warning "Por favor, reinicia el backend manualmente"
    fi
fi
echo ""

# 9. Verificar que el servicio está corriendo
echo "🔍 9. Verificando estado del servicio..."
sleep 3

# Verificar si el proceso uvicorn está corriendo
if pgrep -f "uvicorn main:app" > /dev/null; then
    print_success "Servicio backend está activo"
else
    print_error "Servicio backend no está activo"
    print_warning "Verifica los logs y reinicia el backend manualmente si es necesario"
fi
echo ""

# 10. Ver logs recientes
echo "📋 10. Logs recientes del servicio:"
echo "-----------------------------------"
if sudo systemctl list-units --all | grep -q "backend.service"; then
    sudo journalctl -u backend -n 20 --no-pager
else
    print_warning "No se pueden mostrar logs de systemd (servicio no configurado)"
    echo "Para ver logs manualmente:"
    echo "  tail -f nohup.out"
fi
echo ""

# Resumen final
echo "==================================="
echo -e "${GREEN}✓ DEPLOYMENT COMPLETADO${NC}"
echo "==================================="
echo ""
echo "Cambios aplicados:"
echo "  ✓ Agregada columna archivo_egreso_url a carpetas_tesoreria"
echo "  ✓ Modelo actualizado"
echo "  ✓ Endpoints agregados:"
echo "    - POST /api/v1/carpetas-tesoreria/{id}/archivo-egreso"
echo "    - DELETE /api/v1/carpetas-tesoreria/{id}/archivo-egreso"
echo "  ✓ Servicio backend reiniciado"
echo ""
echo "Siguiente paso:"
echo "  - Probar subir archivo PDF desde el frontend"
echo "  - Verificar que se guarda en S3"
echo "  - Verificar que se puede eliminar"
echo ""
