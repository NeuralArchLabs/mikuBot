# SPDX-License-Identifier: AGPL-3.0-or-later
# SearXNG Windows - Static Files Module

#Requires -Version 5.1

# Importar librerias base
if (-not (Get-Command 'Write-Build' -ErrorAction SilentlyContinue)) {
    . "$PSScriptRoot\lib.ps1"
}

# ---------------------------------------------------------------------------
# Configuracion
# ---------------------------------------------------------------------------

$global:STATIC_DIR = Join-Path $REPO_ROOT "searx\static"
$global:THEMES_DIR = Join-Path $STATIC_DIR "themes"

# ---------------------------------------------------------------------------
# Build de static files
# ---------------------------------------------------------------------------

function Build-StaticCommit {
    Write-Build "STATIC" "build.commit"
    
    $simpleThemeDir = Join-Path $THEMES_DIR "simple"
    $sxngCore = Join-Path $simpleThemeDir "sxng-core.min.js"
    
    if (-not (Test-Path $sxngCore)) {
        Write-Info "Frontend no compilado, ejecutando build primero..."
        . "$PSScriptRoot\lib_sxng_themes.ps1"
        Build-Themes
    }
    
    Push-Location $REPO_ROOT
    try {
        $status = git status --porcelain $STATIC_DIR
        
        if ([string]::IsNullOrEmpty($status)) {
            Write-Info "No hay cambios en archivos estaticos"
            return $true
        }
        
        Write-Info "Cambios detectados en archivos estaticos"
        Write-Host $status
        
        git add $STATIC_DIR
        git commit -m "build: update static files"
        
        return $LASTEXITCODE -eq 0
    } finally {
        Pop-Location
    }
}

function Build-StaticDrop {
    Write-Build "STATIC" "build.drop"
    
    $minFiles = Get-ChildItem -Path $STATIC_DIR -Recurse -Include "*.min.js", "*.min.css" -File -ErrorAction SilentlyContinue
    
    foreach ($file in $minFiles) {
        Write-Info "Eliminando $($file.Name)"
        Remove-Item -Path $file.FullName -Force -ErrorAction SilentlyContinue
    }
    
    $chunkDirs = Get-ChildItem -Path $STATIC_DIR -Recurse -Directory -Filter "chunk" -ErrorAction SilentlyContinue
    foreach ($dir in $chunkDirs) {
        Write-Info "Eliminando directorio chunk"
        Remove-Item -Path $dir.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    Write-Info "Archivos estaticos eliminados"
}

function Build-StaticRestore {
    Write-Build "STATIC" "build.restore"
    
    Push-Location $REPO_ROOT
    try {
        git checkout -- $STATIC_DIR
        Write-Info "Archivos estaticos restaurados"
        return $true
    } catch {
        Write-Err "Error restaurando archivos: $($_.Exception.Message)"
        return $false
    } finally {
        Pop-Location
    }
}
