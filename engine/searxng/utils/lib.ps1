# SPDX-License-Identifier: AGPL-3.0-or-later
# SearXNG Windows Library - PowerShell Equivalent of lib.sh
# Libreria base para scripts de gestion de SearXNG en Windows

#Requires -Version 5.1

# ---------------------------------------------------------------------------
# Configuracion base
# ---------------------------------------------------------------------------

# Detectar REPO_ROOT
if ([string]::IsNullOrEmpty($env:REPO_ROOT)) {
    $scriptPath = $PSScriptRoot
    if ($scriptPath) {
        $global:REPO_ROOT = (Get-Item "$scriptPath\..").FullName
    } else {
        $global:REPO_ROOT = $PWD.Path
    }
}

# Rutas importantes
$global:TEMPLATES = if ($env:TEMPLATES) { $env:TEMPLATES } else { Join-Path $REPO_ROOT "utils\templates" }
$global:CACHE = if ($env:CACHE) { $env:CACHE } else { Join-Path $REPO_ROOT "cache" }
$global:DOT_CONFIG = if ($env:DOT_CONFIG) { $env:DOT_CONFIG } else { Join-Path $REPO_ROOT ".config.ps1" }

# Configuracion Python
$global:PY = if ($env:PY) { $env:PY } else { "3" }
$global:PYTHON = if ($env:PYTHON) { $env:PYTHON } else { "python" }
$global:PY_ENV = if ($env:PY_ENV) { $env:PY_ENV } else { Join-Path $REPO_ROOT "local\py$PY" }
$global:PY_ENV_BIN = Join-Path $PY_ENV "Scripts"
$global:PY_ENV_REQ = if ($env:PY_ENV_REQ) { $env:PY_ENV_REQ } else { Join-Path $REPO_ROOT "requirements*.txt" }
$global:PYOBJECTS = if ($env:PYOBJECTS) { $env:PYOBJECTS } else { "." }
$global:PYDIST = if ($env:PYDIST) { $env:PYDIST } else { "dist" }
$global:PYBUILD = if ($env:PYBUILD) { $env:PYBUILD } else { "build\py$PY" }
$global:PY_SETUP_EXTRAS = if ($env:PY_SETUP_EXTRAS) { $env:PY_SETUP_EXTRAS } else { "[test]" }

# Documentacion
$global:GH_PAGES = "build\gh-pages"
$global:DOCS_DIST = if ($env:DOCS_DIST) { $env:DOCS_DIST } else { "dist\docs" }
$global:DOCS_BUILD = if ($env:DOCS_BUILD) { $env:DOCS_BUILD } else { "build\docs" }

# Admin info (desde git)
$gitName = git config user.name 2>$null
$gitEmail = git config user.email 2>$null
$global:ADMIN_NAME = if ($env:ADMIN_NAME) { $env:ADMIN_NAME } elseif ($gitName) { $gitName } else { $env:USERNAME }
$global:ADMIN_EMAIL = if ($env:ADMIN_EMAIL) { $env:ADMIN_EMAIL } elseif ($gitEmail) { $gitEmail } else { "$env:USERNAME@$env:COMPUTERNAME" }

# ---------------------------------------------------------------------------
# Sistema de colores ANSI (PowerShell 5.1+)
# ---------------------------------------------------------------------------

$global:_creset = "`e[0m"
$global:_Black = "`e[0;30m"
$global:_White = "`e[1;37m"
$global:_Red = "`e[0;31m"
$global:_Green = "`e[0;32m"
$global:_Yellow = "`e[0;33m"
$global:_Blue = "`e[0;94m"
$global:_Violet = "`e[0;35m"
$global:_Cyan = "`e[0;36m"
$global:_BBlack = "`e[1;30m"
$global:_BWhite = "`e[1;37m"
$global:_BRed = "`e[1;31m"
$global:_BGreen = "`e[1;32m"
$global:_BYellow = "`e[1;33m"
$global:_BBlue = "`e[1;94m"
$global:_BPurple = "`e[1;35m"
$global:_BCyan = "`e[1;36m"

# ---------------------------------------------------------------------------
# Funciones de salida con color
# ---------------------------------------------------------------------------

function Write-Title {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Text,
        [ValidateSet("part", "chapter", "section")]
        [string]$Type = "chapter"
    )
    
    $separator = switch ($Type) {
        "part" { "=" }
        "chapter" { "=" }
        "section" { "-" }
    }
    
    $line = $separator * $Text.Length
    
    Write-Host ""
    if ($Type -eq "part") {
        Write-Host "${_BGreen}${line}${_creset}"
    }
    Write-Host "${_BCyan}${Text}${_creset}"
    Write-Host "${_BGreen}${line}${_creset}"
    Write-Host ""
}

function Write-Err {
    param([Parameter(ValueFromPipeline=$true)]$Message)
    Write-Host "${_BRed}ERROR:${_creset} $Message" -ForegroundColor Red
}

function Write-Warn {
    param([Parameter(ValueFromPipeline=$true)]$Message)
    Write-Host "${_BBlue}WARN:${_creset}  $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([Parameter(ValueFromPipeline=$true)]$Message)
    Write-Host "${_BYellow}INFO:${_creset}  $Message" -ForegroundColor Cyan
}

function Write-Build {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Tag,
        [Parameter(ValueFromPipeline=$true)]
        [string]$Message
    )
    
    $padded = ($Tag + "          ").Substring(0, 10)
    Write-Host "${_Blue}${padded}${_creset} $Message"
}

function Die {
    param(
        [int]$Code = 1,
        [string]$Message = "died"
    )
    
    $callStack = Get-PSCallStack
    $caller = if ($callStack.Count -gt 1) { $callStack[1] } else { $callStack[0] }
    
    Write-Err "${caller.ScriptName}: line ${caller.ScriptLineNumber}: $Message"
    exit $Code
}

function Die-Caller {
    param(
        [int]$Code = 1,
        [string]$Message = "died"
    )
    
    $callStack = Get-PSCallStack
    if ($callStack.Count -gt 2) {
        $caller = $callStack[2]
        $funcName = $callStack[1].FunctionName
        Write-Err "${caller.ScriptName}: line ${caller.ScriptLineNumber}: ${funcName}(): $Message"
    }
    exit $Code
}

function Invoke-DumpReturn {
    param([int]$Error)
    
    if ($Error -ne 0) {
        $callStack = Get-PSCallStack
        $funcName = if ($callStack.Count -gt 1) { $callStack[1].FunctionName } else { "main" }
        Write-Err "${funcName} exit with error ($Error)"
    }
    return $Error
}

# Alias para compatibilidad con estilo bash
New-Alias -Name err_msg -Value Write-Err -Force -ErrorAction SilentlyContinue
New-Alias -Name warn_msg -Value Write-Warn -Force -ErrorAction SilentlyContinue
New-Alias -Name info_msg -Value Write-Info -Force -ErrorAction SilentlyContinue
New-Alias -Name build_msg -Value Write-Build -Force -ErrorAction SilentlyContinue
New-Alias -Name dump_return -Value Invoke-DumpReturn -Force -ErrorAction SilentlyContinue
New-Alias -Name rst_title -Value Write-Title -Force -ErrorAction SilentlyContinue

# ---------------------------------------------------------------------------
# Validacion de comandos
# ---------------------------------------------------------------------------

function Test-Commands {
    param([string[]]$Commands)
    
    $exitVal = 0
    foreach ($cmd in $Commands) {
        if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
            Write-Err "missing command $cmd"
            $exitVal = 42
        }
    }
    return $exitVal
}

New-Alias -Name required_commands -Value Test-Commands -Force -ErrorAction SilentlyContinue

# ---------------------------------------------------------------------------
# Interaccion con usuario
# ---------------------------------------------------------------------------

function Wait-Key {
    param(
        [int]$Timeout,
        [string]$Message
    )
    
    if ([string]::IsNullOrEmpty($Message)) {
        $Message = "${_Green}** press any [${_BCyan}KEY${_Green}] to continue **${_creset}"
    }
    
    Write-Host $Message -NoNewline
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown,AllowCtrlC')
    Write-Host ""
}

function Ask-YesNo {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Prompt,
        [ValidateSet("Ny", "Yn", "Y", "N")]
        [string]$Default = "Ny",
        [int]$Timeout
    )
    
    if ($env:FORCE_SELECTION) {
        $Default = $env:FORCE_SELECTION
    }
    
    switch ($Default) {
        "Y" { return $true }
        "N" { return $false }
        "Yn" {
            $exitVal = $true
            $choice = "[${_BGreen}YES${_creset}/no]"
            $defaultText = "Yes"
        }
        default {
            $exitVal = $false
            $choice = "[${_BGreen}NO${_creset}/yes]"
            $defaultText = "No"
        }
    }
    
    Write-Host ""
    while ($true) {
        Write-Host "$Prompt $choice " -NoNewline
        
        $key = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown,AllowCtrlC')
        $response = [char]$key.Character
        
        if ([string]::IsNullOrEmpty($response)) {
            Write-Host $defaultText
            break
        } elseif ($response -match '^[Yy]$') {
            $exitVal = $true
            Write-Host ""
            break
        } elseif ($response -match '^[Nn]$') {
            $exitVal = $false
            Write-Host ""
            break
        }
        
        Write-Err "invalid choice"
    }
    
    return $exitVal
}

New-Alias -Name ask_yn -Value Ask-YesNo -Force -ErrorAction SilentlyContinue

# ---------------------------------------------------------------------------
# Utilidades de archivos
# ---------------------------------------------------------------------------

function Backup-File {
    param([Parameter(Mandatory=$true)][string]$Path)
    
    $stamp = Get-Date -Format "_yyyyMMdd_HHmmss"
    $backupPath = "$Path$stamp"
    
    Write-Info "create backup: $backupPath"
    Copy-Item -Path $Path -Destination $backupPath
}

New-Alias -Name backup_file -Value Backup-File -Force -ErrorAction SilentlyContinue

function Invoke-CacheDownload {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Url,
        [Parameter(Mandatory=$true)]
        [string]$Filename
    )
    
    if (-not (Test-Path $CACHE)) {
        New-Item -ItemType Directory -Path $CACHE -Force | Out-Null
    }
    
    $destPath = Join-Path $CACHE $Filename
    
    if (Test-Path $destPath) {
        Write-Info "already cached: $Url"
        Write-Info "  --> $destPath"
        return $destPath
    }
    
    Write-Info "caching: $Url"
    Write-Info "  --> $destPath"
    
    try {
        Invoke-WebRequest -Uri $Url -OutFile $destPath -UseBasicParsing
        return $destPath
    } catch {
        Write-Err "failed to download: $Url"
        Write-Err $_.Exception.Message
        return $null
    }
}

New-Alias -Name cache_download -Value Invoke-CacheDownload -Force -ErrorAction SilentlyContinue

# ---------------------------------------------------------------------------
# Python Virtualenv
# ---------------------------------------------------------------------------

function Test-PyEnv {
    $pyExe = Join-Path $PY_ENV_BIN "python.exe"
    
    if (-not (Test-Path $pyExe)) {
        Write-Build "PYENV" "[virtualenv] missing $pyExe"
        return $false
    }
    
    $hashFile = Join-Path $PY_ENV "requirements.sha256"
    if (-not (Test-Path $hashFile)) {
        Write-Build "PYENV" "[virtualenv] requirements.sha256 missing"
        return $false
    }
    
    if ($env:VERBOSE -eq "1") {
        Write-Build "PYENV" "OK"
    }
    
    return $true
}

function New-PyEnv {
    if (Test-PyEnv) {
        return $true
    }
    
    $hashFile = Join-Path $PY_ENV "requirements.sha256"
    if (Test-Path $hashFile) {
        Remove-Item $hashFile -Force
    }
    
    Remove-PyEnv
    
    Write-Build "PYENV" "[virtualenv] installing requirements into $PY_ENV"
    
    & $PYTHON -m venv $PY_ENV
    
    $pyExe = Join-Path $PY_ENV_BIN "python.exe"
    
    & $pyExe -m pip install -U pip wheel setuptools
    
    $reqFiles = Get-ChildItem -Path $REPO_ROOT -Filter "requirements*.txt"
    foreach ($req in $reqFiles) {
        Write-Build "PYENV" "[pip] installing $($req.Name)"
        & $pyExe -m pip install -r $req.FullName
    }
    
    return (Test-PyEnv)
}

New-Alias -Name pyenv -Value New-PyEnv -Force -ErrorAction SilentlyContinue

function Remove-PyEnv {
    Write-Build "PYENV" "[virtualenv] drop $PY_ENV"
    if (Test-Path $PY_ENV) {
        Remove-Item -Path $PY_ENV -Recurse -Force
    }
}

New-Alias -Name pyenv.drop -Value Remove-PyEnv -Force -ErrorAction SilentlyContinue

function Install-PyEnvPackage {
    if (-not (Test-PyEnv)) {
        New-PyEnv
    }
    
    $pyExe = Join-Path $PY_ENV_BIN "python.exe"
    
    try {
        Push-Location $REPO_ROOT
        & $pyExe -c "import searx" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Build "PYENV" "[install] already installed"
            Pop-Location
            return $true
        }
    } catch {}
    Pop-Location
    
    Write-Build "PYENV" "[install] pip install --use-pep517 --no-build-isolation -e '.${PY_SETUP_EXTRAS}'"
    
    Push-Location $REPO_ROOT
    & $pyExe -m pip install --use-pep517 --no-build-isolation -e ".${PY_SETUP_EXTRAS}"
    Pop-Location
    
    return ($LASTEXITCODE -eq 0)
}

New-Alias -Name pyenv.install -Value Install-PyEnvPackage -Force -ErrorAction SilentlyContinue

function Enter-PyEnv {
    Install-PyEnvPackage
    
    $activateScript = Join-Path $PY_ENV_BIN "Activate.ps1"
    if (Test-Path $activateScript) {
        . $activateScript
    } else {
        Write-Err "No se encontro Activate.ps1 en $PY_ENV_BIN"
        return $false
    }
    return $true
}

New-Alias -Name pyenv.activate -Value Enter-PyEnv -Force -ErrorAction SilentlyContinue

function Clear-PyEnv {
    Write-Build "CLEAN" "pyenv and .pyc files"
    
    Remove-PyEnv
    
    @($PYDIST, $PYBUILD) | ForEach-Object {
        $p = Join-Path $REPO_ROOT $_
        if (Test-Path $p) {
            Remove-Item -Path $p -Recurse -Force
        }
    }
    
    Get-ChildItem -Path $REPO_ROOT -Recurse -Include "*.pyc" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    Get-ChildItem -Path $REPO_ROOT -Recurse -Include "__pycache__" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Get-ChildItem -Path $REPO_ROOT -Recurse -Include "*.egg-info" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

New-Alias -Name py.clean -Value Clear-PyEnv -Force -ErrorAction SilentlyContinue

# ---------------------------------------------------------------------------
# Descarga de archivos
# ---------------------------------------------------------------------------

function Get-GeckoDriver {
    param([string]$Version = "v0.36.0")
    
    Install-PyEnvPackage
    
    $geckoExe = Join-Path $PY_ENV_BIN "geckodriver.exe"
    
    if (Test-Path $geckoExe) {
        Write-Build "GECKO" "geckodriver already installed"
        return
    }
    
    $arch = if ([Environment]::Is64BitOperatingSystem) { "win64" } else { "win32" }
    $url = "https://github.com/mozilla/geckodriver/releases/download/$Version/geckodriver-$Version-$arch.zip"
    
    Write-Build "GECKO" "Installing geckodriver from $url"
    
    $zipFile = Join-Path $CACHE "geckodriver.zip"
    
    if (-not (Test-Path $CACHE)) {
        New-Item -ItemType Directory -Path $CACHE -Force | Out-Null
    }
    
    Invoke-WebRequest -Uri $url -OutFile $zipFile -UseBasicParsing
    Expand-Archive -Path $zipFile -DestinationPath $PY_ENV_BIN -Force
    Remove-Item $zipFile -Force
    
    Write-Build "GECKO" "geckodriver installed"
}

New-Alias -Name gecko.driver -Value Get-GeckoDriver -Force -ErrorAction SilentlyContinue

# ---------------------------------------------------------------------------
# Git
# ---------------------------------------------------------------------------

function Invoke-GitClone {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Url,
        [Parameter(Mandatory=$true)]
        [string]$Destination,
        [string]$Branch = "master",
        [string]$Remote = "origin"
    )
    
    if (-not [System.IO.Path]::IsPathRooted($Destination)) {
        $Destination = Join-Path $CACHE $Destination
    }
    
    if (Test-Path $Destination) {
        Write-Info "already cloned: $Destination"
        Push-Location $Destination
        git checkout -m -B $Branch --track "$Remote/$Branch" 2>&1 | Write-Host
        git pull --all 2>&1 | Write-Host
        Pop-Location
    } else {
        Write-Info "clone into: $Destination"
        $parentDir = Split-Path $Destination -Parent
        if (-not (Test-Path $parentDir)) {
            New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
        }
        Push-Location $parentDir
        git clone --branch $Branch --origin $Remote $Url (Split-Path $Destination -Leaf) 2>&1 | Write-Host
        Pop-Location
    }
}

New-Alias -Name git_clone -Value Invoke-GitClone -Force -ErrorAction SilentlyContinue

# ---------------------------------------------------------------------------
# Documentacion (Sphinx)
# ---------------------------------------------------------------------------

function Build-DocsHtml {
    Write-Build "SPHINX" "HTML ./docs"
    
    Install-PyEnvPackage
    
    $pyExe = Join-Path $PY_ENV_BIN "python.exe"
    $sphinxBuild = Join-Path $PY_ENV_BIN "sphinx-build.exe"
    
    if (-not (Test-Path $sphinxBuild)) {
        Write-Info "Installing sphinx..."
        & $pyExe -m pip install sphinx sphinx-autobuild myst-parser
    }
    
    $docsDist = Join-Path $REPO_ROOT $DOCS_DIST
    $docsBuild = Join-Path $REPO_ROOT $DOCS_BUILD
    
    Push-Location $REPO_ROOT
    & $sphinxBuild -b html -c ./docs -d "$docsBuild\.doctrees" ./docs $docsDist
    Pop-Location
    
    return ($LASTEXITCODE -eq 0)
}

function Build-DocsLive {
    Write-Build "SPHINX" "autobuild ./docs"
    
    Install-PyEnvPackage
    
    $pyExe = Join-Path $PY_ENV_BIN "python.exe"
    $sphinxAutobuild = Join-Path $PY_ENV_BIN "sphinx-autobuild.exe"
    
    if (-not (Test-Path $sphinxAutobuild)) {
        Write-Info "Installing sphinx-autobuild..."
        & $pyExe -m pip install sphinx-autobuild
    }
    
    $docsDist = Join-Path $REPO_ROOT $DOCS_DIST
    $docsBuild = Join-Path $REPO_ROOT $DOCS_BUILD
    
    Push-Location $REPO_ROOT
    & $sphinxAutobuild --open-browser --host "0.0.0.0" -b html -c ./docs -d "$docsBuild\.doctrees" ./docs $docsDist
    Pop-Location
}

function Clear-Docs {
    Write-Build "CLEAN" "docs"
    
    @($GH_PAGES, $DOCS_BUILD, $DOCS_DIST) | ForEach-Object {
        $p = Join-Path $REPO_ROOT $_
        if (Test-Path $p) {
            Remove-Item -Path $p -Recurse -Force
        }
    }
}
