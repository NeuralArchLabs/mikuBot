# Installer for searXena (Core FastAPI Version)
# This script sets up a local virtualenv and installs dependencies.

$REPO_ROOT = Get-Location
$PY_DIR = Join-Path $REPO_ROOT "local\py3"
$PY_EXE = Join-Path $PY_DIR "Scripts\python.exe"

Write-Host "`n=== Iniciando Instalador de searXena (Windows) ===" -ForegroundColor Cyan
Write-Host "Configurando entorno local en $PY_DIR ...`n" -ForegroundColor Gray

# Create virtual environment if it doesn't exist
if (-not (Test-Path $PY_DIR)) {
    Write-Host "[1/3] Creando entorno virtual (venv)..." -ForegroundColor Yellow
    python -m venv $PY_DIR
    if (-not $?) {
        Write-Host "ERROR: No se pudo crear el venv. Asegurate de tener Python instalado." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[1/3] Entorno virtual ya existe." -ForegroundColor Gray
}

# Upgrade pip and install requirements
Write-Host "[2/3] Instalando dependencias desde requirements.txt..." -ForegroundColor Yellow
& $PY_EXE -m pip install -U pip wheel setuptools
& $PY_EXE -m pip install -r requirements.txt

if ($?) {
    Write-Host "`n[3/3] ¡Instalacion completada con exito!" -ForegroundColor Green
    Write-Host "`nPara iniciar searXena, usa:" -ForegroundColor Gray
    Write-Host "  .\run.ps1" -ForegroundColor Cyan
} else {
    Write-Host "`nERROR durante la instalacion de dependencias. Verifica tu conexion o dependencias manuales." -ForegroundColor Red
    exit 1
}

Write-Host "`n===============================================" -ForegroundColor Cyan
