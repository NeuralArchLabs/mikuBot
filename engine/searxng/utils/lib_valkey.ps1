# SPDX-License-Identifier: AGPL-3.0-or-later
# SearXNG Windows - Valkey/Redis Module

#Requires -Version 5.1

# Importar librerias base
if (-not (Get-Command 'Write-Build' -ErrorAction SilentlyContinue)) {
    . "$PSScriptRoot\lib.ps1"
}

# ---------------------------------------------------------------------------
# Configuracion
# ---------------------------------------------------------------------------

$global:VALKEY_DEFAULT_PORT = 6379
$global:VALKEY_WINDOWS_URL = "https://github.com/valkey-io/valkey/releases"

# ---------------------------------------------------------------------------
# Deteccion y verificacion
# ---------------------------------------------------------------------------

function Test-ValkeyInstalled {
    if (Get-Command 'valkey-server' -ErrorAction SilentlyContinue) {
        return $true
    }
    if (Get-Command 'redis-server' -ErrorAction SilentlyContinue) {
        return $true
    }
    if (Get-Command 'redis-cli' -ErrorAction SilentlyContinue) {
        return $true
    }
    return $false
}

function Test-ValkeyRunning {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $connect = $client.BeginConnect("localhost", $VALKEY_DEFAULT_PORT, $null, $null)
        $wait = $connect.AsyncWaitHandle.WaitOne(1000)
        
        if ($wait) {
            $client.EndConnect($connect)
            $client.Close()
            return $true
        }
        
        $client.Close()
        return $false
    } catch {
        return $false
    }
}

# ---------------------------------------------------------------------------
# Instalacion
# ---------------------------------------------------------------------------

function Install-ValkeyWindows {
    Write-Host ""
    Write-Title "Instalacion de Valkey para Windows"
    
    Write-Host "Valkey es un fork moderno de Redis, compatible al 100%."
    Write-Host ""
    Write-Host "Opciones de instalacion:"
    Write-Host "------------------------"
    Write-Host ""
    Write-Host "1. Descarga directa:"
    Write-Host "   $VALKEY_WINDOWS_URL"
    Write-Host ""
    Write-Host "2. Con Chocolatey (recomendado):"
    Write-Host "   choco install redis-64"
    Write-Host ""
    Write-Host "3. Con Scoop:"
    Write-Host "   scoop install redis"
    Write-Host ""
    Write-Host "4. Docker:"
    Write-Host "   docker run -d -p 6379:6379 valkey/valkey:latest"
    Write-Host ""
    Write-Host "Despues de instalar, inicia el servidor con:"
    Write-Host "   redis-server"
    Write-Host ""
    
    if (Test-ValkeyInstalled) {
        Write-Info "Valkey/Redis ya esta instalado!"
        
        if (Test-ValkeyRunning) {
            Write-Info "El servidor esta corriendo en el puerto $VALKEY_DEFAULT_PORT"
        } else {
            Write-Info "El servidor no esta corriendo. Inicia con: redis-server"
        }
    }
}

# ---------------------------------------------------------------------------
# Control de servicio
# ---------------------------------------------------------------------------

function Start-Valkey {
    param(
        [string]$ConfigFile,
        [int]$Port = $VALKEY_DEFAULT_PORT
    )
    
    if (Test-ValkeyRunning) {
        Write-Info "Valkey/Redis ya esta corriendo en el puerto $Port"
        return $true
    }
    
    $server = Get-Command 'valkey-server' -ErrorAction SilentlyContinue
    if (-not $server) {
        $server = Get-Command 'redis-server' -ErrorAction SilentlyContinue
    }
    
    if (-not $server) {
        Write-Err "No se encontro valkey-server ni redis-server"
        Install-ValkeyWindows
        return $false
    }
    
    Write-Build "VALKEY" "iniciando servidor en puerto $Port"
    
    $args = @("--port", $Port)
    if ($ConfigFile) {
        $args += @($ConfigFile)
    }
    
    Start-Process -FilePath $server.Source -ArgumentList $args -WindowStyle Hidden
    
    Start-Sleep -Seconds 2
    
    if (Test-ValkeyRunning) {
        Write-Info "Servidor iniciado correctamente"
        return $true
    } else {
        Write-Err "No se pudo iniciar el servidor"
        return $false
    }
}

function Stop-Valkey {
    if (-not (Test-ValkeyRunning)) {
        Write-Info "El servidor no esta corriendo"
        return $true
    }
    
    if (Get-Command 'redis-cli' -ErrorAction SilentlyContinue) {
        Write-Build "VALKEY" "deteniendo servidor..."
        & redis-cli SHUTDOWN NOSAVE 2>$null
        Start-Sleep -Seconds 1
    }
    
    if (Test-ValkeyRunning) {
        Write-Info "Terminando procesos..."
        Get-Process | Where-Object { $_.ProcessName -match "valkey|redis" } | Stop-Process -Force -ErrorAction SilentlyContinue
    }
    
    Write-Info "Servidor detenido"
    return $true
}
