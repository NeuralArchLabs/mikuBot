# SPDX-License-Identifier: AGPL-3.0-or-later
# SearXNG Windows - Node.js Management Module

#Requires -Version 5.1

# Importar libreria base si no esta cargada
if (-not (Get-Command 'Write-Build' -ErrorAction SilentlyContinue)) {
    . "$PSScriptRoot\lib.ps1"
}

# ---------------------------------------------------------------------------
# Configuracion
# ---------------------------------------------------------------------------

$global:NODE_MIN_VERSION = "24.3.0"
$global:NODE_ENV_DIR = Join-Path $REPO_ROOT "node_modules"
$global:CLIENT_DIR = Join-Path $REPO_ROOT "client\simple"

# ---------------------------------------------------------------------------
# Funciones de verificacion
# ---------------------------------------------------------------------------

function Test-NodeInstalled {
    return $null -ne (Get-Command 'node' -ErrorAction SilentlyContinue)
}

function Get-NodeVersion {
    if (-not (Test-NodeInstalled)) {
        return $null
    }
    $version = (& node --version).TrimStart('v')
    return $version
}

function Test-NodeVersion {
    param([string]$MinVersion = $NODE_MIN_VERSION)
    
    $currentVersion = Get-NodeVersion
    if (-not $currentVersion) {
        return $false
    }
    
    try {
        $current = [version]$currentVersion
        $min = [version]$MinVersion
        return $current -ge $min
    } catch {
        return [string]::Compare($currentVersion, $MinVersion) -ge 0
    }
}

function Assert-Node {
    if (-not (Test-NodeInstalled)) {
        Write-Err "Node.js no encontrado. Instala Node.js $NODE_MIN_VERSION+ desde https://nodejs.org/"
        exit 1
    }
    
    $version = Get-NodeVersion
    Write-Build "NODE" "version encontrada: $version (minimo requerido: $NODE_MIN_VERSION)"
    
    if (-not (Test-NodeVersion)) {
        Write-Err "Node.js version $version es muy antigua. Se requiere $NODE_MIN_VERSION o superior."
        Write-Info "Descarga la ultima version LTS desde: https://nodejs.org/"
        exit 1
    }
}

# ---------------------------------------------------------------------------
# Funciones de instalacion
# ---------------------------------------------------------------------------

function Install-NodeEnv {
    Assert-Node
    
    Write-Build "INSTALL" "[npm] $CLIENT_DIR\package.json"
    
    Push-Location $CLIENT_DIR
    try {
        & npm install
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    
    if ($exitCode -ne 0) {
        Write-Err "npm install fallo con codigo $exitCode"
        return $false
    }
    
    return $true
}

function Install-NodeEnvDev {
    Assert-Node
    
    $rootPackage = Join-Path $REPO_ROOT "package.json"
    
    if (-not (Test-Path $rootPackage)) {
        Write-Info "No hay package.json en la raiz, saltando..."
        return $true
    }
    
    Write-Build "INSTALL" "[npm] $REPO_ROOT\package.json (dev tools)"
    
    Push-Location $REPO_ROOT
    try {
        & npm install
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    
    return $exitCode -eq 0
}

function Clear-NodeEnv {
    Write-Build "CLEAN" "node_modules locales"
    
    $clientModules = Join-Path $CLIENT_DIR "node_modules"
    if (Test-Path $clientModules) {
        Remove-Item -Path $clientModules -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    $rootModules = Join-Path $REPO_ROOT "node_modules"
    if (Test-Path $rootModules) {
        Remove-Item -Path $rootModules -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    $lockFile = Join-Path $REPO_ROOT "package-lock.json"
    if (Test-Path $lockFile) {
        Remove-Item -Path $lockFile -Force -ErrorAction SilentlyContinue
    }
}

# ---------------------------------------------------------------------------
# Funciones de build
# ---------------------------------------------------------------------------

function Invoke-NpmBuild {
    Assert-Node
    
    $packageJson = Join-Path $CLIENT_DIR "package.json"
    if (-not (Test-Path $packageJson)) {
        Write-Err "No se encontro package.json en $CLIENT_DIR"
        return $false
    }
    
    $nodeModules = Join-Path $CLIENT_DIR "node_modules"
    if (-not (Test-Path $nodeModules)) {
        Write-Info "node_modules no encontrado, ejecutando npm install..."
        if (-not (Install-NodeEnv)) {
            return $false
        }
    }
    
    Write-Build "BUILD" "npm run build en $CLIENT_DIR"
    
    Push-Location $CLIENT_DIR
    try {
        & npm run build
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    
    if ($exitCode -ne 0) {
        Write-Err "npm run build fallo con codigo $exitCode"
        return $false
    }
    
    return $true
}

function Get-NvmStatus {
    Write-Host ""
    Write-Host "Node Version Manager (nvm-windows):"
    Write-Host "--------------------------------"
    
    $nvm = Get-Command 'nvm' -ErrorAction SilentlyContinue
    if ($nvm) {
        Write-Host "NVM instalado: $($nvm.Source)"
        & nvm version
        Write-Host ""
        Write-Host "Versiones disponibles:"
        & nvm list
    } else {
        Write-Info "NVM no esta instalado"
        Write-Host ""
        Write-Host "Para instalar nvm-windows:"
        Write-Host "  1. Descarga desde: https://github.com/coreybutler/nvm-windows/releases"
        Write-Host "  2. Ejecuta el instalador"
        Write-Host "  3. Abre una nueva terminal y ejecuta: nvm install lts"
    }
    
    Write-Host ""
    Write-Host "Version actual de Node: $(Get-NodeVersion)"
    Write-Host "Version requerida: $NODE_MIN_VERSION+"
}
