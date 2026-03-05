# SPDX-License-Identifier: AGPL-3.0-or-later
# SearXNG Windows Build Script
# Script de build independiente (alternativa a Makefile)

#Requires -Version 5.1

param(
    [Parameter(Position=0)]
    [string]$Target = "help",
    
    [switch]$Force,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
$REPO_ROOT = $PSScriptRoot

# Colores
$_creset = "`e[0m"
$_Green = "`e[0;32m"
$_BYellow = "`e[1;33m"
$_BCyan = "`e[1;36m"
$_BRed = "`e[1;31m"

function Write-Status {
    param([string]$Message)
    Write-Host "${_BYellow}==>${_creset} $Message"
}

function Write-Done {
    Write-Host "${_Green}Done!${_creset}"
}

# ---------------------------------------------------------------------------
# Targets
# ---------------------------------------------------------------------------

function Invoke-Help {
    Write-Host @"

${_BCyan}SearXNG Windows Build Script${_creset}
${_Green}=========================${_creset}

Uso: .\build.ps1 <target>

Targets disponibles:

  ${_BYellow}Instalacion:${_creset}
    install       - Instala todo el entorno de desarrollo
    reinstall     - Reinstala desde cero
    
  ${_BYellow}Build:${_creset}
    build         - Compila frontend y backend
    build.frontend - Compila solo el frontend
    build.static  - Compila archivos estaticos
    
  ${_BYellow}Ejecucion:${_creset}
    run           - Inicia el servidor de desarrollo
    
  ${_BYellow}Tests:${_creset}
    test          - Ejecuta tests unitarios
    test.all      - Ejecuta todos los tests
    test.coverage - Tests con cobertura
    
  ${_BYellow}Lint:${_creset}
    lint          - Ejecuta todos los lintings
    lint.python   - Linting Python
    lint.frontend - Linting frontend
    
  ${_BYellow}Format:${_creset}
    format        - Formatea todo el codigo
    
  ${_BYellow}Limpieza:${_creset}
    clean         - Limpia archivos temporales
    clean.all     - Limpia todo (incluido virtualenv)
    clean.frontend- Limpia node_modules
    
  ${_BYellow}Docs:${_creset}
    docs          - Construye documentacion HTML
    docs.clean    - Limpia archivos de docs
    
  ${_BYellow}Datos:${_creset}
    data          - Actualiza todos los datos
    
  ${_BYellow}Utilidades:${_creset}
    check         - Verifica que todo este instalado
    help          - Muestra esta ayuda

Ejemplos:
  .\build.ps1 install
  .\build.ps1 run
  .\build.ps1 test
  .\build.ps1 clean.all

"@
}

function Invoke-Check {
    Write-Host ""
    Write-Host "${_BCyan}Verificando entorno de desarrollo...${_creset}"
    Write-Host ""
    
    $errors = 0
    
    # Python
    Write-Host "Python: " -NoNewline
    $py = Get-Command python -ErrorAction SilentlyContinue
    if ($py) {
        $version = (& python --version 2>&1).ToString()
        Write-Host "${_Green}$version${_creset}"
    } else {
        Write-Host "${_BRed}NO INSTALADO${_creset}"
        $errors++
    }
    
    # Node.js
    Write-Host "Node.js: " -NoNewline
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        $version = (& node --version 2>&1).ToString()
        Write-Host "${_Green}$version${_creset}"
    } else {
        Write-Host "${_BRed}NO INSTALADO${_creset}"
        $errors++
    }
    
    # Virtualenv
    Write-Host "Virtualenv: " -NoNewline
    $venv = Join-Path $REPO_ROOT "local\py3\Scripts\python.exe"
    if (Test-Path $venv) {
        Write-Host "${_Green}OK${_creset}"
    } else {
        Write-Host "${_BYellow}No creado (ejecuta 'install')${_creset}"
    }
    
    # Node modules
    Write-Host "node_modules: " -NoNewline
    $modules = Join-Path $REPO_ROOT "client\simple\node_modules"
    if (Test-Path $modules) {
        Write-Host "${_Green}OK${_creset}"
    } else {
        Write-Host "${_BYellow}No instalado (ejecuta 'install')${_creset}"
    }
    
    # Static files
    Write-Host "Static files: " -NoNewline
    $static = Join-Path $REPO_ROOT "searx\static\themes\simple\sxng-core.min.js"
    if (Test-Path $static) {
        Write-Host "${_Green}OK${_creset}"
    } else {
        Write-Host "${_BYellow}No compilado (ejecuta 'build')${_creset}"
    }
    
    Write-Host ""
    
    if ($errors -gt 0) {
        Write-Host "${_BRed}Se encontraron $errors errores.${_creset}"
        Write-Host "Instala las dependencias faltantes antes de continuar."
        return $false
    }
    
    Write-Host "${_Green}Entorno listo para desarrollo!${_creset}"
    return $true
}

function Invoke-Install {
    Write-Status "Instalando entorno de desarrollo..."
    
    # Ejecutar win_setup.ps1 si existe
    $setup = Join-Path $REPO_ROOT "win_setup.ps1"
    if (Test-Path $setup) {
        Write-Status "Ejecutando win_setup.ps1..."
        & $setup
    } else {
        # Instalacion manual
        Write-Status "Creando virtualenv Python..."
        & python -m venv (Join-Path $REPO_ROOT "local\py3")
        
        $py = Join-Path $REPO_ROOT "local\py3\Scripts\python.exe"
        
        Write-Status "Instalando dependencias Python..."
        & $py -m pip install -U pip wheel setuptools
        & $py -m pip install -r (Join-Path $REPO_ROOT "requirements.txt")
        & $py -m pip install -r (Join-Path $REPO_ROOT "requirements-dev.txt")
        
        Write-Status "Instalando SearXNG..."
        Push-Location $REPO_ROOT
        & $py -m pip install --use-pep517 --no-build-isolation -e ".[test]"
        Pop-Location
        
        Write-Status "Instalando dependencias Node.js..."
        Push-Location (Join-Path $REPO_ROOT "client\simple")
        & npm install
        Pop-Location
        
        Write-Status "Compilando frontend..."
        Push-Location (Join-Path $REPO_ROOT "client\simple")
        & npm run build
        Pop-Location
    }
    
    Write-Done
}

function Invoke-Reinstall {
    Write-Status "Reinstalando desde cero..."
    Invoke-CleanAll
    Invoke-Install
}

function Invoke-Build {
    Write-Status "Compilando proyecto..."
    Invoke-BuildFrontend
    Write-Done
}

function Invoke-BuildFrontend {
    Write-Status "Compilando frontend..."
    
    $clientDir = Join-Path $REPO_ROOT "client\simple"
    
    if (-not (Test-Path (Join-Path $clientDir "node_modules"))) {
        Write-Status "Instalando node_modules..."
        Push-Location $clientDir
        & npm install
        Pop-Location
    }
    
    Push-Location $clientDir
    & npm run build
    Pop-Location
    
    Write-Done
}

function Invoke-BuildStatic {
    Write-Status "Compilando archivos estaticos..."
    & ".\manage.ps1" static.build.commit
}

function Invoke-Run {
    Write-Status "Iniciando servidor de desarrollo..."
    & ".\manage.ps1" webapp.run
}

function Invoke-Test {
    Write-Status "Ejecutando tests unitarios..."
    & ".\manage.ps1" test
}

function Invoke-TestAll {
    Write-Status "Ejecutando todos los tests..."
    & ".\manage.ps1" test.full
}

function Invoke-TestCoverage {
    Write-Status "Ejecutando tests con cobertura..."
    & ".\manage.ps1" test.coverage
}

function Invoke-Lint {
    Write-Status "Ejecutando lintings..."
    & ".\manage.ps1" lint.all
}

function Invoke-LintPython {
    Write-Status "Linting Python..."
    & ".\manage.ps1" lint.python
}

function Invoke-LintFrontend {
    Write-Status "Linting frontend..."
    & ".\manage.ps1" themes.lint
}

function Invoke-Format {
    Write-Status "Formateando codigo..."
    & ".\manage.ps1" format.all
}

function Invoke-Clean {
    Write-Status "Limpiando archivos temporales..."
    
    # Archivos .pyc
    Get-ChildItem -Path $REPO_ROOT -Recurse -Include "*.pyc" | Remove-Item -Force -ErrorAction SilentlyContinue
    
    # __pycache__
    Get-ChildItem -Path $REPO_ROOT -Recurse -Include "__pycache__" -Directory | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    
    # .orig, .rej
    Get-ChildItem -Path $REPO_ROOT -Recurse -Include "*.orig", "*.rej", "*~" | Remove-Item -Force -ErrorAction SilentlyContinue
    
    Write-Done
}

function Invoke-CleanAll {
    Write-Status "Limpiando todo..."
    
    # Virtualenv
    $venv = Join-Path $REPO_ROOT "local"
    if (Test-Path $venv) {
        Write-Host "Eliminando virtualenv..."
        Remove-Item -Path $venv -Recurse -Force
    }
    
    # node_modules
    $modules = Join-Path $REPO_ROOT "client\simple\node_modules"
    if (Test-Path $modules) {
        Write-Host "Eliminando node_modules..."
        Remove-Item -Path $modules -Recurse -Force
    }
    
    # build, dist
    @("build", "dist") | ForEach-Object {
        $p = Join-Path $REPO_ROOT $_
        if (Test-Path $p) {
            Remove-Item -Path $p -Recurse -Force
        }
    }
    
    Invoke-Clean
    Invoke-DocsClean
    
    Write-Done
}

function Invoke-CleanFrontend {
    Write-Status "Limpiando frontend..."
    & ".\manage.ps1" node.clean
}

function Invoke-Docs {
    Write-Status "Construyendo documentacion..."
    & ".\manage.ps1" docs.html
}

function Invoke-DocsClean {
    Write-Status "Limpiando documentacion..."
    & ".\manage.ps1" docs.clean
}

function Invoke-Data {
    Write-Status "Actualizando datos..."
    & ".\manage.ps1" data.all
}

# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

Push-Location $REPO_ROOT
try {
    switch ($Target) {
        "help" { Invoke-Help }
        "check" { Invoke-Check }
        
        "install" { Invoke-Install }
        "reinstall" { Invoke-Reinstall }
        
        "build" { Invoke-Build }
        "build.frontend" { Invoke-BuildFrontend }
        "build.static" { Invoke-BuildStatic }
        "all" { Invoke-Build }
        
        "run" { Invoke-Run }
        
        "test" { Invoke-Test }
        "test.all" { Invoke-TestAll }
        "test.coverage" { Invoke-TestCoverage }
        
        "lint" { Invoke-Lint }
        "lint.python" { Invoke-LintPython }
        "lint.frontend" { Invoke-LintFrontend }
        
        "format" { Invoke-Format }
        
        "clean" { Invoke-Clean }
        "clean.all" { Invoke-CleanAll }
        "clean.frontend" { Invoke-CleanFrontend }
        
        "docs" { Invoke-Docs }
        "docs.clean" { Invoke-DocsClean }
        
        "data" { Invoke-Data }
        
        default {
            Write-Host "${_BRed}Target desconocido: '$Target'${_creset}"
            Invoke-Help
            exit 1
        }
    }
} finally {
    Pop-Location
}
