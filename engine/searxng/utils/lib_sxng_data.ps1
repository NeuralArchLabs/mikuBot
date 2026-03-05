# SPDX-License-Identifier: AGPL-3.0-or-later
# SearXNG Windows - Data Update Module

#Requires -Version 5.1

# Importar librerias base
if (-not (Get-Command 'Write-Build' -ErrorAction SilentlyContinue)) {
    . "$PSScriptRoot\lib.ps1"
}

# ---------------------------------------------------------------------------
# Configuracion
# ---------------------------------------------------------------------------

$global:DATA_DIR = Join-Path $REPO_ROOT "searx\data"
$global:UPDATE_SCRIPTS_DIR = Join-Path $REPO_ROOT "searxng_extra\update"

# ---------------------------------------------------------------------------
# Funciones de actualizacion
# ---------------------------------------------------------------------------

function Update-AllData {
    Write-Build "DATA" "actualizando todos los datos"
    
    Enter-PyEnv
    
    Push-Location $REPO_ROOT
    try {
        $scripts = Get-ChildItem -Path $UPDATE_SCRIPTS_DIR -Filter "update_*.py" -ErrorAction SilentlyContinue
        
        foreach ($script in $scripts) {
            Write-Info "Ejecutando $($script.Name)..."
            & python $script.FullName
            if ($LASTEXITCODE -ne 0) {
                Write-Err "Error en $($script.Name)"
            }
        }
    } finally {
        Pop-Location
    }
}

function Update-Currencies {
    Write-Build "DATA" "actualizando monedas"
    
    Enter-PyEnv
    
    $script = Join-Path $UPDATE_SCRIPTS_DIR "update_currencies.py"
    
    if (-not (Test-Path $script)) {
        Write-Err "Script no encontrado: $script"
        return $false
    }
    
    Push-Location $REPO_ROOT
    try {
        & python $script
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    
    return $exitCode -eq 0
}

function Update-EngineTraits {
    Write-Build "DATA" "actualizando engine traits"
    
    Enter-PyEnv
    
    $script = Join-Path $UPDATE_SCRIPTS_DIR "update_engine_traits.py"
    
    if (-not (Test-Path $script)) {
        Write-Err "Script no encontrado: $script"
        return $false
    }
    
    Push-Location $REPO_ROOT
    try {
        & python $script
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    
    return $exitCode -eq 0
}

function Update-UserAgents {
    Write-Build "DATA" "actualizando user agents"
    
    Enter-PyEnv
    
    $script = Join-Path $UPDATE_SCRIPTS_DIR "update_gsa_useragents.py"
    
    if (-not (Test-Path $script)) {
        Write-Err "Script no encontrado: $script"
        return $false
    }
    
    Push-Location $REPO_ROOT
    try {
        & python $script
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    
    return $exitCode -eq 0
}

function Update-Locales {
    Write-Build "DATA" "actualizando locales"
    
    Enter-PyEnv
    
    $script = Join-Path $UPDATE_SCRIPTS_DIR "update_locales.py"
    
    if (-not (Test-Path $script)) {
        Write-Err "Script no encontrado: $script"
        return $false
    }
    
    Push-Location $REPO_ROOT
    try {
        & python $script
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    
    return $exitCode -eq 0
}
