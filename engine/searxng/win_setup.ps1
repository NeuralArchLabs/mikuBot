# SPDX-License-Identifier: AGPL-3.0-or-later
# SearXNG Windows Setup - Instalador one-shot
# Ejecutar UNA VEZ para configurar el entorno completo en Windows

$ErrorActionPreference = "Stop"
$REPO_ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

function Title([string]$msg) {
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Green
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Green
    Write-Host ""
}

function Step([string]$msg) {
    Write-Host ">> $msg" -ForegroundColor Yellow
}

function Ok([string]$msg) {
    Write-Host "OK  $msg" -ForegroundColor Green
}

function Fail([string]$msg) {
    Write-Host "ERR $msg" -ForegroundColor Red
    exit 1
}

# ---------------------------------------------------------------------------
Title "SearXNG Windows Setup"
# ---------------------------------------------------------------------------

# 1. Verificar Python
Step "Verificando Python..."
try {
    $pyver = & python --version 2>&1
    Ok $pyver
} catch {
    Fail "Python no encontrado. Instala Python 3.10+ desde https://www.python.org/downloads/"
}

$verMatch = $pyver -match '(\d+)\.(\d+)'
if ($verMatch) {
    $major = [int]$Matches[1]
    $minor = [int]$Matches[2]
    if ($major -lt 3 -or ($major -eq 3 -and $minor -lt 10)) {
        Fail "Se requiere Python 3.10+. Version actual: $pyver"
    }
}

# 2. Verificar Node.js
Step "Verificando Node.js..."
try {
    $nodever = & node --version 2>&1
    Ok "Node.js $nodever"
} catch {
    Write-Host "AVISO: Node.js no encontrado. El frontend no se compilara." -ForegroundColor Yellow
    Write-Host "       Instala Node.js 24+ desde https://nodejs.org/" -ForegroundColor Yellow
    $skipNode = $true
}

# 3. Crear virtualenv
Step "Creando entorno virtual Python..."
$PY_ENV = Join-Path $REPO_ROOT "local\py3"
$PY_BIN = Join-Path $PY_ENV "Scripts"
$PY_EXE = Join-Path $PY_BIN "python.exe"

if (Test-Path $PY_EXE) {
    Ok "Virtualenv ya existe en $PY_ENV"
} else {
    Set-Location $REPO_ROOT
    & python -m venv $PY_ENV
    Ok "Virtualenv creado en $PY_ENV"
}

# 4. Actualizar pip
Step "Actualizando pip, wheel, setuptools..."
& $PY_EXE -m pip install -U pip wheel setuptools
Ok "pip actualizado"

# 5. Instalar dependencias Python
Step "Instalando dependencias de requirements.txt..."
& $PY_EXE -m pip install -r (Join-Path $REPO_ROOT "requirements.txt")
Ok "requirements.txt instalado"

# 6. Instalar SearXNG en modo desarrollo
Step "Instalando SearXNG en modo desarrollo..."
Set-Location $REPO_ROOT
& $PY_EXE -m pip install --use-pep517 --no-build-isolation -e ".[test]"
Ok "SearXNG instalado"

# 7. Frontend (opcional)
if (-not $skipNode) {
    Step "Instalando dependencias npm del frontend..."
    Set-Location (Join-Path $REPO_ROOT "client\simple")
    & npm install
    Ok "npm install completado"

    Step "Compilando temas con Vite..."
    & npm run build
    Ok "Temas compilados"
    Set-Location $REPO_ROOT
}

# 8. Verificar que granian esta instalado
Step "Verificando Granian (servidor WSGI)..."
$granian = Join-Path $PY_BIN "granian.exe"
if (Test-Path $granian) {
    Ok "Granian encontrado: $granian"
} else {
    Step "Instalando Granian..."
    & $PY_EXE -m pip install "granian[reload]"
    Ok "Granian instalado"
}

# ---------------------------------------------------------------------------
Title "Setup completado exitosamente"
# ---------------------------------------------------------------------------

Write-Host @"
Para iniciar SearXNG:

  .\manage.ps1 webapp.run

O manualmente:

  .\local\py3\Scripts\Activate.ps1
  granian --interface wsgi --host 127.0.0.1 --port 8888 searx.webapp:app

Luego abre: http://127.0.0.1:8888/
"@ -ForegroundColor Cyan
