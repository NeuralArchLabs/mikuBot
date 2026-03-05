# SPDX-License-Identifier: AGPL-3.0-or-later
# SearXNG Windows - Themes Management Module

#Requires -Version 5.1

# Importar librerias base
if (-not (Get-Command 'Write-Build' -ErrorAction SilentlyContinue)) {
    . "$PSScriptRoot\lib.ps1"
}
. "$PSScriptRoot\lib_sxng_node.ps1"

# ---------------------------------------------------------------------------
# Configuracion
# ---------------------------------------------------------------------------

$global:CLIENT_DIR = Join-Path $REPO_ROOT "client\simple"
$global:THEMES_STATIC_DIR = Join-Path $REPO_ROOT "searx\static\themes\simple"

# ---------------------------------------------------------------------------
# Build de temas
# ---------------------------------------------------------------------------

function Build-Themes {
    Assert-Node
    
    $nodeModules = Join-Path $CLIENT_DIR "node_modules"
    if (-not (Test-Path $nodeModules)) {
        Write-Info "Instalando dependencias npm..."
        Install-NodeEnv
    }
    
    Write-Build "THEMES" "construyendo temas con Vite"
    
    Push-Location $CLIENT_DIR
    try {
        & npm run build
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    
    if ($exitCode -ne 0) {
        Write-Err "Build de temas fallo"
        return $false
    }
    
    if (Test-Path $THEMES_STATIC_DIR) {
        $files = Get-ChildItem -Path $THEMES_STATIC_DIR -Filter "*.min.*" -Recurse -ErrorAction SilentlyContinue
        Write-Info "Generados $($files.Count) archivos minificados"
    }
    
    return $true
}

function Build-ThemesLive {
    param([string]$Theme = "simple")
    
    Assert-Node
    
    Write-Build "THEMES" "modo desarrollo (hot reload) para tema: $Theme"
    Write-Info "Abre http://localhost:8888 en tu navegador"
    Write-Info "Los cambios en el frontend se recargaran automaticamente"
    Write-Host ""
    
    Push-Location $CLIENT_DIR
    try {
        $packageContent = Get-Content "package.json" -Raw | ConvertFrom-Json
        if ($packageContent.scripts.dev) {
            & npm run dev
        } else {
            & npx vite --host
        }
    } finally {
        Pop-Location
    }
}

function Test-Themes {
    Assert-Node
    
    Write-Build "TEST" "tests del frontend"
    
    Push-Location $CLIENT_DIR
    try {
        $packageContent = Get-Content "package.json" -Raw | ConvertFrom-Json
        if ($packageContent.scripts.test) {
            & npm test
        } else {
            Write-Info "No hay tests configurados en package.json"
        }
    } finally {
        Pop-Location
    }
}

function Invoke-ThemesLint {
    Assert-Node
    
    Write-Build "LINT" "linting de temas"
    
    Push-Location $CLIENT_DIR
    try {
        $packageContent = Get-Content "package.json" -Raw | ConvertFrom-Json
        
        if ($packageContent.scripts.lint) {
            & npm run lint
        } else {
            Write-Info "No hay script lint configurado"
        }
    } finally {
        Pop-Location
    }
}

function Invoke-ThemesFix {
    Assert-Node
    
    Write-Build "FIX" "corrigiendo problemas de linting"
    
    Push-Location $CLIENT_DIR
    try {
        $packageContent = Get-Content "package.json" -Raw | ConvertFrom-Json
        
        if ($packageContent.scripts."lint:fix") {
            & npm run lint:fix
        } elseif ($packageContent.scripts.format) {
            & npm run format
        } else {
            Write-Info "Ejecutando biome format..."
            & npx biome format --write ./src
        }
    } finally {
        Pop-Location
    }
}
