# SPDX-License-Identifier: AGPL-3.0-or-later
# SearXNG Windows - Testing Module

#Requires -Version 5.1

# Importar librerias base
if (-not (Get-Command 'Write-Build' -ErrorAction SilentlyContinue)) {
    . "$PSScriptRoot\lib.ps1"
}

# ---------------------------------------------------------------------------
# Configuracion
# ---------------------------------------------------------------------------

$global:TEST_DIR = Join-Path $REPO_ROOT "tests"
$global:UNIT_TEST_DIR = Join-Path $TEST_DIR "unit"

# ---------------------------------------------------------------------------
# Tests unitarios
# ---------------------------------------------------------------------------

function Invoke-UnitTests {
    param(
        [string]$Pattern = "test_*.py",
        [switch]$Verbose
    )
    
    Enter-PyEnv
    
    Write-Build "TEST" "ejecutando tests unitarios"
    
    $pytest = Join-Path $PY_ENV_BIN "pytest.exe"
    
    if (-not (Test-Path $pytest)) {
        Write-Info "pytest no encontrado, instalando..."
        & (Join-Path $PY_ENV_BIN "pip.exe") install pytest
    }
    
    $args = @("tests/unit")
    if ($Verbose) {
        $args = @("-v") + $args
    }
    
    Push-Location $REPO_ROOT
    try {
        & $pytest @args
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    
    return $exitCode -eq 0
}

function Invoke-Coverage {
    Enter-PyEnv
    
    Write-Build "COVERAGE" "ejecutando tests con cobertura"
    
    $pytest = Join-Path $PY_ENV_BIN "pytest.exe"
    
    Push-Location $REPO_ROOT
    try {
        & $pytest --cov=searx --cov-report=term-missing tests/unit
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    
    return $exitCode -eq 0
}

# ---------------------------------------------------------------------------
# Linting
# ---------------------------------------------------------------------------

function Invoke-PythonLint {
    param(
        [string[]]$Paths = @("searx", "searxng_extra", "tests"),
        [switch]$Fix
    )
    
    Enter-PyEnv
    
    $pylint = Join-Path $PY_ENV_BIN "pylint.exe"
    
    if (-not (Test-Path $pylint)) {
        Write-Err "pylint no encontrado"
        return $false
    }
    
    Write-Build "LINT" "pylint"
    
    Push-Location $REPO_ROOT
    try {
        & $pylint $Paths
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    
    return $exitCode -in @(0, 4, 8, 16, 32)
}

function Invoke-Black {
    param(
        [string[]]$Paths = @("searx", "searxng_extra", "tests"),
        [switch]$Check
    )
    
    Enter-PyEnv
    
    $black = Join-Path $PY_ENV_BIN "black.exe"
    
    if (-not (Test-Path $black)) {
        Write-Err "black no encontrado"
        return $false
    }
    
    Write-Build "FORMAT" "black"
    
    $args = @(
        "--target-version", "py311",
        "--line-length", "120",
        "--skip-string-normalization"
    )
    
    if ($Check) {
        $args += "--check"
    }
    
    $args += $Paths
    
    Push-Location $REPO_ROOT
    try {
        & $black @args
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    
    return $exitCode -eq 0
}

function Invoke-YamlLint {
    Enter-PyEnv
    
    $yamllint = Join-Path $PY_ENV_BIN "yamllint.exe"
    
    if (-not (Test-Path $yamllint)) {
        Write-Err "yamllint no encontrado"
        return $false
    }
    
    Write-Build "LINT" "yamllint"
    
    $yamlFiles = Get-ChildItem -Path $REPO_ROOT -Recurse -Include "*.yml", "*.yaml" -File -ErrorAction SilentlyContinue | 
        Where-Object { $_.FullName -notmatch "node_modules|\.venv|$PY_ENV" }
    
    if ($yamlFiles.Count -eq 0) {
        Write-Info "No se encontraron archivos YAML"
        return $true
    }
    
    Push-Location $REPO_ROOT
    try {
        & $yamllint -d relaxed $yamlFiles.FullName
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    
    return $exitCode -eq 0
}

# ---------------------------------------------------------------------------
# Robot tests (Selenium)
# ---------------------------------------------------------------------------

function Invoke-RobotTests {
    Enter-PyEnv
    
    Get-GeckoDriver
    
    Write-Build "ROBOT" "tests de integracion"
    
    $robotTestDir = Join-Path $TEST_DIR "robot"
    
    if (-not (Test-Path $robotTestDir)) {
        Write-Info "No hay tests robot en $robotTestDir"
        return $true
    }
    
    Push-Location $REPO_ROOT
    try {
        python -m robot.run --outputdir build/robot-results $robotTestDir
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    
    return $exitCode -eq 0
}

# ---------------------------------------------------------------------------
# Test completo
# ---------------------------------------------------------------------------

function Invoke-FullTest {
    Write-Host ""
    Write-Title "Ejecutando suite completa de tests"
    
    $results = @{}
    
    $results['black'] = Invoke-Black -Check
    $results['pylint'] = Invoke-PythonLint
    $results['yamllint'] = Invoke-YamlLint
    $results['unit'] = Invoke-UnitTests
    
    Write-Host ""
    Write-Title "Resumen de tests"
    
    $allPassed = $true
    foreach ($test in $results.GetEnumerator()) {
        $status = if ($test.Value) { "${_Green}PASS${_creset}" } else { "${_Red}FAIL${_creset}" }
        Write-Host "  $($test.Key): $status"
        if (-not $test.Value) { $allPassed = $false }
    }
    
    Write-Host ""
    
    return $allPassed
}
