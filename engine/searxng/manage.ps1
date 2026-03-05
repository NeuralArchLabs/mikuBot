# SPDX-License-Identifier: AGPL-3.0-or-later
# SearXNG - Windows Native Management Script

#Requires -Version 5.1

param(
    [Parameter(Position=0)]
    [string]$Command = "",
    [Parameter(ValueFromRemainingArguments)]
    [string[]]$Args
)

$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# Configuracion base
# ---------------------------------------------------------------------------

$REPO_ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$PY = "3"
$PY_ENV = Join-Path $REPO_ROOT "local\py$PY"
$PY_ENV_BIN = Join-Path $PY_ENV "Scripts"
$PY_EXE = Join-Path $PY_ENV_BIN "python.exe"
$GRANIAN_EXE = Join-Path $PY_ENV_BIN "granian.exe"

# ---------------------------------------------------------------------------
# Importar modulos
# ---------------------------------------------------------------------------

$libPath = Join-Path $REPO_ROOT "utils\lib.ps1"
if (Test-Path $libPath) {
    . $libPath
} else {
    Write-Host "ERROR: No se encontro lib.ps1" -ForegroundColor Red
    exit 1
}

$modules = @(
    "lib_sxng_node.ps1",
    "lib_sxng_themes.ps1",
    "lib_sxng_test.ps1",
    "lib_sxng_data.ps1",
    "lib_sxng_static.ps1",
    "lib_valkey.ps1"
)

foreach ($module in $modules) {
    $modulePath = Join-Path $REPO_ROOT "utils\$module"
    if (Test-Path $modulePath) {
        . $modulePath
    }
}

# ---------------------------------------------------------------------------
# Funciones Python
# ---------------------------------------------------------------------------

function Test-PyEnv {
    return (Test-Path $PY_EXE)
}

function New-PyEnv {
    if (-not (Test-PyEnv)) {
        Write-Build "PYENV" "[virtualenv] creando entorno en $PY_ENV"
        & python -m venv $PY_ENV
        & $PY_EXE -m pip install -U pip wheel setuptools
    }
}

function Install-PyDeps {
    Write-Build "PYENV" "[install] pip install requirements*.txt"
    $reqFiles = Get-ChildItem -Path $REPO_ROOT -Filter "requirements*.txt"
    foreach ($req in $reqFiles) {
        & $PY_EXE -m pip install -r $req.FullName
    }
}

function Install-SearXNG {
    Write-Build "PYENV" "[install] pip install -e .[test]"
    Push-Location $REPO_ROOT
    try {
        & $PY_EXE -m pip install --use-pep517 --no-build-isolation -e ".[test]"
    } finally {
        Pop-Location
    }
}

function Invoke-PyEnvInstall {
    New-PyEnv
    Install-PyDeps
    Install-SearXNG
    # Instalar granian con el extra pname para process name
    Write-Build "PYENV" "[install] granian[pname]"
    & $PY_EXE -m pip install "granian[pname]"
    Write-Build "PYENV" "OK"
}

function Invoke-PyEnvUninstall {
    Write-Build "PYENV" "[uninstall] searxng"
    & $PY_EXE -m pip uninstall -y searxng
}

function Enter-PyEnv {
    $activate = Join-Path $PY_ENV_BIN "Activate.ps1"
    if (Test-Path $activate) {
        . $activate
    } else {
        Write-Err "No se encontro Activate.ps1"
        exit 1
    }
}

function Clear-PyEnv {
    Write-Build "CLEAN" "pyenv y archivos .pyc"
    
    if (Test-Path $PY_ENV) {
        Remove-Item -Recurse -Force $PY_ENV
    }
    
    @("dist", "build") | ForEach-Object {
        $p = Join-Path $REPO_ROOT $_
        if (Test-Path $p) { Remove-Item -Recurse -Force $p }
    }
    
    Get-ChildItem -Path $REPO_ROOT -Recurse -Include "*.pyc" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    Get-ChildItem -Path $REPO_ROOT -Recurse -Include "__pycache__" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Get-ChildItem -Path $REPO_ROOT -Recurse -Include "*.egg-info" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------------------
# Webapp
# ---------------------------------------------------------------------------

function Start-Webapp {
    if (-not (Test-PyEnv)) {
        Invoke-PyEnvInstall
    }
    
    Write-Build "WEBAPP" "iniciando SearXNG en http://127.0.0.1:8888/"
    
    # Abrir navegador despues de 3 segundos
    $null = Start-Job -ScriptBlock {
        Start-Sleep 3
        Start-Process "http://127.0.0.1:8888/"
    }
    
    # Variables de entorno para Granian
    $env:SEARXNG_DEBUG = "1"
    # Deshabilitado para evitar problemas de cache en Windows
    # $env:GRANIAN_RELOAD = "true"
    # $env:GRANIAN_RELOAD_IGNORE_WORKER_FAILURE = "true"
    # $env:GRANIAN_RELOAD_PATHS = ".\searx"
    $env:GRANIAN_INTERFACE = "wsgi"
    $env:GRANIAN_HOST = "127.0.0.1"
    $env:GRANIAN_PORT = "8888"
    $env:GRANIAN_WEBSOCKETS = "false"
    $env:GRANIAN_BLOCKING_THREADS = "4"
    $env:GRANIAN_WORKERS_KILL_TIMEOUT = "30s"
    $env:GRANIAN_BLOCKING_THREADS_IDLE_TIMEOUT = "5m"
    
    Enter-PyEnv
    & $GRANIAN_EXE searx.webapp:app
}

# ---------------------------------------------------------------------------
# Node.js
# ---------------------------------------------------------------------------

function Invoke-NodeEnv {
    Install-NodeEnv
}

function Invoke-NodeEnvDev {
    Install-NodeEnvDev
}

function Clear-NodeEnvLocal {
    Clear-NodeEnv
}

# ---------------------------------------------------------------------------
# Themes
# ---------------------------------------------------------------------------

function Build-Themes {
    . (Join-Path $REPO_ROOT "utils\lib_sxng_themes.ps1")
    Build-Themes
}

function Build-ThemesLive {
    param([string]$Theme = "simple")
    . (Join-Path $REPO_ROOT "utils\lib_sxng_themes.ps1")
    Build-ThemesLive -Theme $Theme
}

function Test-Themes {
    . (Join-Path $REPO_ROOT "utils\lib_sxng_themes.ps1")
    Test-Themes
}

function Lint-Themes {
    . (Join-Path $REPO_ROOT "utils\lib_sxng_themes.ps1")
    Invoke-ThemesLint
}

function Fix-Themes {
    . (Join-Path $REPO_ROOT "utils\lib_sxng_themes.ps1")
    Invoke-ThemesFix
}

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

function Invoke-Tests {
    . (Join-Path $REPO_ROOT "utils\lib_sxng_test.ps1")
    Invoke-UnitTests
}

function Invoke-TestsVerbose {
    . (Join-Path $REPO_ROOT "utils\lib_sxng_test.ps1")
    Invoke-UnitTests -Verbose
}

function Invoke-Coverage {
    . (Join-Path $REPO_ROOT "utils\lib_sxng_test.ps1")
    Invoke-Coverage
}

function Invoke-PythonLint {
    . (Join-Path $REPO_ROOT "utils\lib_sxng_test.ps1")
    Invoke-PythonLint
}

function Invoke-Black {
    . (Join-Path $REPO_ROOT "utils\lib_sxng_test.ps1")
    Invoke-Black
}

function Invoke-BlackCheck {
    . (Join-Path $REPO_ROOT "utils\lib_sxng_test.ps1")
    Invoke-Black -Check
}

function Invoke-YamlLint {
    . (Join-Path $REPO_ROOT "utils\lib_sxng_test.ps1")
    Invoke-YamlLint
}

function Invoke-Pyright {
    . (Join-Path $REPO_ROOT "utils\lib_sxng_test.ps1")
    Invoke-Pyright
}

function Invoke-RobotTests {
    . (Join-Path $REPO_ROOT "utils\lib_sxng_test.ps1")
    Invoke-RobotTests
}

function Invoke-FullTest {
    . (Join-Path $REPO_ROOT "utils\lib_sxng_test.ps1")
    Invoke-FullTest
}

# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------

function Update-AllData {
    . (Join-Path $REPO_ROOT "utils\lib_sxng_data.ps1")
    Update-AllData
}

function Update-Currencies {
    . (Join-Path $REPO_ROOT "utils\lib_sxng_data.ps1")
    Update-Currencies
}

function Update-EngineTraits {
    . (Join-Path $REPO_ROOT "utils\lib_sxng_data.ps1")
    Update-EngineTraits
}

function Update-UserAgents {
    . (Join-Path $REPO_ROOT "utils\lib_sxng_data.ps1")
    Update-UserAgents
}

function Update-Locales {
    . (Join-Path $REPO_ROOT "utils\lib_sxng_data.ps1")
    Update-Locales
}

# ---------------------------------------------------------------------------
# Static
# ---------------------------------------------------------------------------

function Build-StaticCommit {
    . (Join-Path $REPO_ROOT "utils\lib_sxng_static.ps1")
    Build-StaticCommit
}

function Build-StaticDrop {
    . (Join-Path $REPO_ROOT "utils\lib_sxng_static.ps1")
    Build-StaticDrop
}

function Build-StaticRestore {
    . (Join-Path $REPO_ROOT "utils\lib_sxng_static.ps1")
    Build-StaticRestore
}

# ---------------------------------------------------------------------------
# Docs
# ---------------------------------------------------------------------------

function Build-DocsHtml {
    Write-Build "DOCS" "HTML ./docs"
    Enter-PyEnv
    
    $sphinxBuild = Join-Path $PY_ENV_BIN "sphinx-build.exe"
    
    if (-not (Test-Path $sphinxBuild)) {
        Write-Info "Instalando sphinx..."
        & $PY_EXE -m pip install sphinx sphinx-autobuild myst-parser
    }
    
    $docsDist = Join-Path $REPO_ROOT "dist\docs"
    $docsBuild = Join-Path $REPO_ROOT "build\docs"
    
    Push-Location $REPO_ROOT
    try {
        & $sphinxBuild -b html -c ./docs -d "$docsBuild\.doctrees" ./docs $docsDist
    } finally {
        Pop-Location
    }
}

function Build-DocsLive {
    Write-Build "DOCS" "autobuild ./docs"
    Enter-PyEnv
    
    $sphinxAutobuild = Join-Path $PY_ENV_BIN "sphinx-autobuild.exe"
    
    if (-not (Test-Path $sphinxAutobuild)) {
        Write-Info "Instalando sphinx-autobuild..."
        & $PY_EXE -m pip install sphinx-autobuild
    }
    
    $docsDist = Join-Path $REPO_ROOT "dist\docs"
    $docsBuild = Join-Path $REPO_ROOT "build\docs"
    
    Push-Location $REPO_ROOT
    try {
        & $sphinxAutobuild --open-browser --host "0.0.0.0" -b html -c ./docs -d "$docsBuild\.doctrees" ./docs $docsDist
    } finally {
        Pop-Location
    }
}

function Clear-Docs {
    Write-Build "CLEAN" "docs"
    
    @("build\gh-pages", "build\docs", "dist\docs") | ForEach-Object {
        $p = Join-Path $REPO_ROOT $_
        if (Test-Path $p) { Remove-Item -Recurse -Force $p }
    }
}

# ---------------------------------------------------------------------------
# Valkey
# ---------------------------------------------------------------------------

function Get-ValkeyStatus {
    . (Join-Path $REPO_ROOT "utils\lib_valkey.ps1")
    
    Write-Host ""
    Write-Title "Estado de Valkey/Redis"
    
    if (Test-ValkeyInstalled) {
        Write-Info "Valkey/Redis esta instalado"
        
        if (Test-ValkeyRunning) {
            Write-Info "Servidor corriendo en puerto 6379"
        } else {
            Write-Info "Servidor no esta corriendo"
        }
    } else {
        Write-Warn "Valkey/Redis no esta instalado"
        Install-ValkeyWindows
    }
}

function Start-ValkeyServer {
    . (Join-Path $REPO_ROOT "utils\lib_valkey.ps1")
    Start-Valkey
}

function Stop-ValkeyServer {
    . (Join-Path $REPO_ROOT "utils\lib_valkey.ps1")
    Stop-Valkey
}

# ---------------------------------------------------------------------------
# Format
# ---------------------------------------------------------------------------

function Format-Python {
    . (Join-Path $REPO_ROOT "utils\lib_sxng_test.ps1")
    Invoke-Black
}

function Format-All {
    Write-Build "FORMAT" "formateando codigo"
    Format-Python
}

# ---------------------------------------------------------------------------
# Gecko
# ---------------------------------------------------------------------------

function Install-Gecko {
    Write-Build "GECKO" "instalando geckodriver"
    Get-GeckoDriver
}

# ---------------------------------------------------------------------------
# NVM
# ---------------------------------------------------------------------------

function Get-NvmInfo {
    Get-NvmStatus
}

# ---------------------------------------------------------------------------
# Clean all
# ---------------------------------------------------------------------------

function Clear-All {
    Write-Build "CLEAN" "todo"
    Clear-PyEnv
    Clear-NodeEnv
    Clear-Docs
    
    Get-ChildItem -Path $REPO_ROOT -Recurse -Include "*.orig", "*.rej", "*~", "*.bak" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

function Show-Help {
    Write-Host @"

${_BCyan}SearXNG Windows Management Script${_creset}
${_BGreen}=================================${_creset}

Uso:  .\manage.ps1 <comando>

${_BYellow}Webapp:${_creset}
  webapp.run              Inicia el servidor de desarrollo

${_BYellow}Python:${_creset}
  pyenv.install           Crea virtualenv e instala dependencias
  py.clean                Elimina virtualenv

${_BYellow}Node.js:${_creset}
  node.env                Instala dependencias npm
  node.clean              Elimina node_modules

${_BYellow}Themes:${_creset}
  themes.build            Compila los temas
  themes.live             Modo desarrollo con hot reload

${_BYellow}Tests:${_creset}
  test                    Ejecuta tests unitarios
  test.full               Ejecuta todos los tests

${_BYellow}Linting:${_creset}
  lint.python             Ejecuta pylint
  lint.black              Formatea con black

${_BYellow}Format:${_creset}
  format.python           Formatea codigo Python

${_BYellow}Docs:${_creset}
  docs.html               Construye documentacion

${_BYellow}Valkey:${_creset}
  valkey.status           Estado del servidor
  valkey.start            Inicia servidor
  valkey.stop             Detiene servidor

${_BYellow}Utilidades:${_creset}
  clean.all               Limpia todo
  help                    Muestra esta ayuda

"@
}

# ---------------------------------------------------------------------------
# Dispatcher principal
# ---------------------------------------------------------------------------

Push-Location $REPO_ROOT
try {
    switch ($Command) {
        "" { Show-Help }
        "help" { Show-Help }
        "webapp.run" { Start-Webapp }
        "run" { Start-Webapp }
        "pyenv.install" { Invoke-PyEnvInstall }
        "pyenv.uninstall" { Invoke-PyEnvUninstall }
        "py.clean" { Clear-PyEnv }
        "node.env" { Invoke-NodeEnv }
        "node.env.dev" { Invoke-NodeEnvDev }
        "node.clean" { Clear-NodeEnvLocal }
        "nvm.status" { Get-NvmInfo }
        "themes.build" { Build-Themes }
        "themes.live" { Build-ThemesLive }
        "themes.test" { Test-Themes }
        "themes.lint" { Lint-Themes }
        "themes.fix" { Fix-Themes }
        "test" { Invoke-Tests }
        "test.verbose" { Invoke-TestsVerbose }
        "test.coverage" { Invoke-Coverage }
        "test.full" { Invoke-FullTest }
        "test.robot" { Invoke-RobotTests }
        "lint.python" { Invoke-PythonLint }
        "lint.black" { Invoke-BlackCheck }
        "lint.all" { Invoke-FullTest }
        "format.python" { Format-Python }
        "format.all" { Format-All }
        "data.all" { Update-AllData }
        "data.currencies" { Update-Currencies }
        "data.traits" { Update-EngineTraits }
        "static.build.commit" { Build-StaticCommit }
        "docs.html" { Build-DocsHtml }
        "docs.live" { Build-DocsLive }
        "docs.clean" { Clear-Docs }
        "valkey.status" { Get-ValkeyStatus }
        "valkey.start" { Start-ValkeyServer }
        "valkey.stop" { Stop-ValkeyServer }
        "valkey.install" { . (Join-Path $REPO_ROOT "utils\lib_valkey.ps1"); Install-ValkeyWindows }
        "gecko.driver" { Install-Gecko }
        "clean" { Clear-All }
        "clean.all" { Clear-All }
        "install" { Invoke-PyEnvInstall }
        default {
            Write-Err "Comando desconocido: '$Command'"
            Write-Info "Usa 'help' para ver los comandos disponibles."
            exit 1
        }
    }
} finally {
    Pop-Location
}
