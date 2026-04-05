# Lanzador Nativo de searXena
$REPO_ROOT = Get-Location
$PY_EXE = Join-Path $REPO_ROOT "local\py3\Scripts\python.exe"

Write-Host "`n--- Iniciando searXena (Core Nativo) ---" -ForegroundColor Cyan
Write-Host "Configurando entorno de busqueda..." -ForegroundColor Gray

if (Test-Path $PY_EXE) {
    Write-Host "Iniciando servidor en http://127.0.0.1:8000 ..." -ForegroundColor Green
    Start-Process "http://127.0.0.1:8000"
    & $PY_EXE core/app.py
}
else {
    Write-Host "ERROR: Entorno Python no encontrado en $PY_EXE" -ForegroundColor Red
}
