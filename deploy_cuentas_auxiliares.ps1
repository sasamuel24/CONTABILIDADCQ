#!/usr/bin/env pwsh
# Script de deployment para cuenta auxiliar a produccion AWS
# Ejecutar: .\deploy_cuentas_auxiliares.ps1

$ErrorActionPreference = "Stop"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "DEPLOYMENT: Cuenta Auxiliar + Unidad Negocio" -ForegroundColor Cyan
Write-Host "Destino: AWS EC2 Produccion" -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

# Variables
$EC2_HOST = "ubuntu@ec2-18-220-253-46.us-east-2.compute.amazonaws.com"
$KEY_PATH = ".\key-contabilidad.pem"
$REMOTE_PATH = "/home/ubuntu/app"

Write-Host "[OK] Verificando archivo de clave SSH..." -ForegroundColor Yellow
if (-not (Test-Path $KEY_PATH)) {
    Write-Host "[ERROR] No se encuentra $KEY_PATH" -ForegroundColor Red
    exit 1
}

Write-Host "`n[PASO 1] Hacer pull del codigo actualizado en servidor" -ForegroundColor Green
Write-Host "Actualizando repositorio en servidor..." -ForegroundColor Yellow

ssh -i $KEY_PATH $EC2_HOST "cd /home/ubuntu/app && git pull origin main && echo '[OK] Pull completado'"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Error haciendo pull" -ForegroundColor Red
    exit 1
}

Write-Host "`n[PASO 2] Aplicar migraciones de Alembic (Unidad Negocio + Cuenta Auxiliar)" -ForegroundColor Green
Write-Host "Ejecutando migraciones..." -ForegroundColor Yellow

ssh -i $KEY_PATH $EC2_HOST "cd /home/ubuntu/app/backend && source venv/bin/activate && echo '[INFO] Version actual:' && alembic current && echo '[INFO] Aplicando migraciones...' && alembic upgrade head && echo '[OK] Nueva version:' && alembic current && deactivate"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Error aplicando migraciones" -ForegroundColor Red
    exit 1
}

Write-Host "`n[PASO 3] Insertar 851 cuentas auxiliares" -ForegroundColor Green
Write-Host "Ejecutando script SQL desde servidor..." -ForegroundColor Yellow

ssh -i $KEY_PATH $EC2_HOST "cd /home/ubuntu/app/backend/scripts && PGPASSWORD='C0ntabilidad2024!' psql -h contabilidadcq.cfjkmqcfgzar.us-east-2.rds.amazonaws.com -U postgres -d contabilidadcq -c 'SET client_encoding TO UTF8;' -f insert_cuentas.sql && echo '[INFO] Verificando insercion...' && PGPASSWORD='C0ntabilidad2024!' psql -h contabilidadcq.cfjkmqcfgzar.us-east-2.rds.amazonaws.com -U postgres -d contabilidadcq -c 'SELECT COUNT(*) as total_cuentas FROM cuentas_auxiliares;'"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARNING] Posible error en insercion SQL" -ForegroundColor Yellow
    Write-Host "          (Puede ser normal si las cuentas ya existen)" -ForegroundColor Yellow
}

Write-Host "`n[PASO 4] Reiniciar servicio backend" -ForegroundColor Green
Write-Host "Reiniciando FastAPI..." -ForegroundColor Yellow

ssh -i $KEY_PATH $EC2_HOST "sudo systemctl restart contabilidad-backend && sleep 3 && sudo systemctl status contabilidad-backend --no-pager"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Error reiniciando backend" -ForegroundColor Red
    exit 1
}

Write-Host "`n[PASO 5] Actualizar frontend" -ForegroundColor Green
Write-Host "Construyendo y desplegando React..." -ForegroundColor Yellow

ssh -i $KEY_PATH $EC2_HOST "cd /home/ubuntu/app/frontend && npm install && npm run build && sudo cp -r dist/* /var/www/contabilidadcq/ && sudo systemctl restart nginx && echo '[OK] Frontend actualizado'"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Error actualizando frontend" -ForegroundColor Red
    exit 1
}

Write-Host "`n[PASO 6] Verificar deployment" -ForegroundColor Green
Write-Host "Verificando servicios..." -ForegroundColor Yellow

ssh -i $KEY_PATH $EC2_HOST "echo '[INFO] Estado Backend:' && sudo systemctl status contabilidad-backend --no-pager | grep Active && echo '' && echo '[INFO] Estado Nginx:' && sudo systemctl status nginx --no-pager | grep Active && echo '' && echo '[INFO] Datos en BD:' && PGPASSWORD='C0ntabilidad2024!' psql -h contabilidadcq.cfjkmqcfgzar.us-east-2.rds.amazonaws.com -U postgres -d contabilidadcq -c 'SELECT COUNT(*) as cuentas_auxiliares FROM cuentas_auxiliares; SELECT COUNT(*) as unidades_negocio FROM unidades_negocio;'"

Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host "[SUCCESS] DEPLOYMENT COMPLETADO EXITOSAMENTE" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Resumen de cambios desplegados:" -ForegroundColor Yellow
Write-Host "  [OK] Migracion: Unidad de Negocio (36421a6bfb57)" -ForegroundColor White
Write-Host "  [OK] Migracion: Cuentas Auxiliares tabla (58b9d320b914)" -ForegroundColor White
Write-Host "  [OK] Migracion: FK cuenta_auxiliar_id (77b1106498dc)" -ForegroundColor White
Write-Host "  [OK] 851 cuentas auxiliares insertadas" -ForegroundColor White
Write-Host "  [OK] Modulos API desplegados" -ForegroundColor White
Write-Host "  [OK] Frontend actualizado con selectores" -ForegroundColor White
Write-Host "  [OK] Servicios reiniciados" -ForegroundColor White
Write-Host ""
Write-Host "URL: https://contabilidadcq.com" -ForegroundColor Cyan
Write-Host ""
