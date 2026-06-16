# Lanza el diagnóstico de rendimiento contra RDS a través del túnel SSH.
# Requiere que el túnel esté activo (.\start-tunnel.ps1 en otra ventana).
#
# Uso normal:        .\diagnostico-rds.ps1
# Resetear métricas: .\diagnostico-rds.ps1 -Reset
#   (resetea pg_stat_statements; luego reproduce la lentitud en la app y corre SIN -Reset)

param([switch]$Reset)

$tunnel = Test-NetConnection -ComputerName localhost -Port 5433 -WarningAction SilentlyContinue
if (-not $tunnel.TcpTestSucceeded) {
    Write-Host "ERROR: El tunel SSH no esta activo en el puerto 5433." -ForegroundColor Red
    Write-Host "Abrelo primero en otra ventana con: .\start-tunnel.ps1" -ForegroundColor Yellow
    exit 1
}
Write-Host "Tunel SSH detectado en puerto 5433." -ForegroundColor Green

Copy-Item .env .env.backup -Force
Copy-Item .env.rds .env -Force
Write-Host ".env apuntando a RDS (backup en .env.backup)." -ForegroundColor Yellow

if (Test-Path ".venv\Scripts\Activate.ps1") { . .venv\Scripts\Activate.ps1 }

try {
    if ($Reset) {
        python scripts/diagnostico_rendimiento.py --reset
    } else {
        python scripts/diagnostico_rendimiento.py
    }
} finally {
    Copy-Item .env.backup .env -Force
    Remove-Item .env.backup -Force
    Write-Host ".env restaurado." -ForegroundColor Green
}
