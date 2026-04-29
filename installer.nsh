!include "LogicLib.nsh"

; --- UI and Visibility Configuration ---
!define MUI_ABORTWARNING
!define MUI_INSTFILESPAGE_SHOWDETAILS show
!define MUI_UNINSTFILESPAGE_SHOWDETAILS show
ShowInstDetails show

; -------------------------------------------------------------------------
; 1. Pre-Initialization (System Checks BEFORE the installer UI appears)
; -------------------------------------------------------------------------
!macro preInit
  ; Note: This runs very early. No UI is visible yet.
  
  ; 1.1 Check for Git
  nsExec::ExecToStack 'cmd /c "git --version"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    ; Early check placeholder
  ${EndIf}
!macroend

; -------------------------------------------------------------------------
; 2. Custom Header (Language Strings)
; -------------------------------------------------------------------------
!macro customHeader
  ; --- Language Strings Definitions ---
  ; Spanish (1034 & 3082)
  LangString INSTALL_START 1034 "🚀 Iniciando la instalación de MikuCentral v2.4.0"
  LangString INSTALL_START 3082 "🚀 Iniciando la instalación de MikuCentral v2.4.0"
  LangString INSTALL_SUBTITLE 1034 "🌟 Tu Asistente de IA Personal para Windows"
  LangString INSTALL_SUBTITLE 3082 "🌟 Tu Asistente de IA Personal para Windows"
  LangString TIP_ONBOARDING 1034 "CONSEJO: Al iniciar, el Onboarding te guiará paso a paso."
  LangString TIP_ONBOARDING 3082 "CONSEJO: Al iniciar, el Onboarding te guiará paso a paso."
  LangString TIP_LEARN 1034 "MikuCentral puede aprender sobre ti para ser hiper-específica."
  LangString TIP_LEARN 3082 "MikuCentral puede aprender sobre ti para ser hiper-específica."
  LangString PHASE_1 1034 "🔍 Fase 1: Verificando requisitos del sistema..."
  LangString PHASE_1 3082 "🔍 Fase 1: Verificando requisitos del sistema..."
  LangString CHECK_GIT 1034 "Comprobando herramientas de desarrollo (Git)..."
  LangString CHECK_GIT 3082 "Comprobando herramientas de desarrollo (Git)..."
  LangString WARN_GIT 1034 "AVISO: Git no detectado. Es necesario para clonar repositorios."
  LangString WARN_GIT 3082 "AVISO: Git no detectado. Es necesario para clonar repositorios."
  LangString MSG_GIT 1034 "Git es necesario para clonar repositorios y utilizar el motor de comandos avanzado en Workspaces.$\r$\nGit no fue detectado en tu sistema.$\r$\n$\r$\n¿Deseas descargar e instalar Git for Windows ahora?"
  LangString MSG_GIT 3082 "Git es necesario para clonar repositorios y utilizar el motor de comandos avanzado en Workspaces.$\r$\nGit no fue detectado en tu sistema.$\r$\n$\r$\n¿Deseas descargar e instalar Git for Windows ahora?"
  LangString DESC_GIT 1034 "⬇️ Descargando Git for Windows..."
  LangString DESC_GIT 3082 "⬇️ Descargando Git for Windows..."
  LangString INST_GIT 1034 "🛠️ Instalando Git en modo silencioso..."
  LangString INST_GIT 3082 "🛠️ Instalando Git en modo silencioso..."
  LangString SUCCESS_GIT 1034 "✅ Git instalado correctamente."
  LangString SUCCESS_GIT 3082 "✅ Git instalado correctamente."
  LangString DETECT_GIT 1034 "✅ Git detectado correctamente: $1"
  LangString DETECT_GIT 3082 "✅ Git detectado correctamente: $1"
  LangString TIP_TELEGRAM_1 1034 "RECOMENDACIÓN: Activa la vinculación con Telegram"
  LangString TIP_TELEGRAM_1 3082 "RECOMENDACIÓN: Activa la vinculación con Telegram"
  LangString TIP_TELEGRAM_2 1034 "si quieres operar tu asistente 24/7 desde cualquier lugar."
  LangString TIP_TELEGRAM_2 3082 "si quieres operar tu asistente 24/7 desde cualquier lugar."
  LangString CHECK_VC 1034 "Comprobando librerías de sistema (VC++ Redist)..."
  LangString CHECK_VC 3082 "Comprobando librerías de sistema (VC++ Redist)..."
  LangString WARN_VC 1034 "AVISO: Librerías Visual C++ faltantes. Son obligatorias para la IA."
  LangString WARN_VC 3082 "AVISO: Librerías Visual C++ faltantes. Son obligatorias para la IA."
  LangString MSG_VC 1034 "MikuCentral requiere 'Microsoft Visual C++ Redistributable 2015-2022' para los módulos de IA en tu equipo.$\r$\nNo fue detectado.$\r$\n$\r$\n¿Deseas descargarlo e instalarlo ahora? (Altamente Recomendado)"
  LangString MSG_VC 3082 "MikuCentral requiere 'Microsoft Visual C++ Redistributable 2015-2022' para los módulos de IA en tu equipo.$\r$\nNo fue detectado.$\r$\n$\r$\n¿Deseas descargarlo e instalarlo ahora? (Altamente Recomendado)"
  LangString DESC_VC 1034 "⬇️ Descargando VC++ Redistributable x64..."
  LangString DESC_VC 3082 "⬇️ Descargando VC++ Redistributable x64..."
  LangString INST_VC 1034 "🛠️ Instalando librerías del sistema... (Instalación silenciosa)"
  LangString INST_VC 3082 "🛠️ Instalando librerías del sistema... (Instalación silenciosa)"
  LangString SUCCESS_VC 1034 "✅ Librerías instaladas."
  LangString SUCCESS_VC 3082 "✅ Librerías instaladas."
  LangString DETECT_VC 1034 "✅ Librerías Visual C++ detectadas."
  LangString DETECT_VC 3082 "✅ Librerías Visual C++ detectadas."
  LangString INFO_PYTHON_1 1034 "ℹ️ MikuCentral incluye un motor Python 3.11 embebido"
  LangString INFO_PYTHON_1 3082 "ℹ️ MikuCentral incluye un motor Python 3.11 embebido"
  LangString INFO_PYTHON_2 1034 "utilizado para SearXena y reconocimiento de voz (Vosk)."
  LangString INFO_PYTHON_2 3082 "utilizado para SearXena y reconocimiento de voz (Vosk)."
  LangString FINISH 1034 "🎉 Todo listo. Finalizando la copia de archivos..."
  LangString FINISH 3082 "🎉 Todo listo. Finalizando la copia de archivos..."

  ; English (1033)
  LangString INSTALL_START 1033 "🚀 Starting installation of MikuCentral v2.4.0"
  LangString INSTALL_SUBTITLE 1033 "🌟 Your Personal AI Assistant for Windows"
  LangString TIP_ONBOARDING 1033 "TIP: Upon launch, Onboarding will guide you step by step."
  LangString TIP_LEARN 1033 "MikuCentral can learn about you to become hyper-specific."
  LangString PHASE_1 1033 "🔍 Phase 1: Verifying system requirements..."
  LangString CHECK_GIT 1033 "Checking development tools (Git)..."
  LangString WARN_GIT 1033 "WARNING: Git not detected. It's required for cloning repositories."
  LangString MSG_GIT 1033 "Git is required to clone repositories and use the advanced command engine in Workspaces.$\r$\nGit was not detected on your system.$\r$\n$\r$\nDo you want to download and install Git for Windows now?"
  LangString DESC_GIT 1033 "⬇️ Downloading Git for Windows..."
  LangString INST_GIT 1033 "🛠️ Installing Git in silent mode..."
  LangString SUCCESS_GIT 1033 "✅ Git installed correctly."
  LangString DETECT_GIT 1033 "✅ Git detected correctly: $1"
  LangString TIP_TELEGRAM_1 1033 "RECOMMENDATION: Enable Telegram pairing"
  LangString TIP_TELEGRAM_2 1033 "if you want to operate your assistant 24/7 from anywhere."
  LangString CHECK_VC 1033 "Checking system libraries (VC++ Redist)..."
  LangString CHECK_VC 3082 "Checking system libraries (VC++ Redist)..."
  LangString WARN_VC 1033 "WARNING: Visual C++ libraries missing. They are mandatory for AI."
  LangString MSG_VC 1033 "MikuCentral requires 'Microsoft Visual C++ Redistributable 2015-2022' for AI modules on your computer.$\r$\nIt was not detected.$\r$\n$\r$\nDo you want to download and install it now? (Highly Recommended)"
  LangString DESC_VC 1033 "⬇️ Downloading VC++ Redistributable x64..."
  LangString INST_VC 1033 "🛠️ Installing system libraries... (Silent installation)"
  LangString SUCCESS_VC 1033 "✅ Libraries installed."
  LangString DETECT_VC 1033 "✅ Visual C++ libraries detected."
  LangString INFO_PYTHON_1 1033 "ℹ️ MikuCentral includes an embedded Python 3.11 engine"
  LangString INFO_PYTHON_2 1033 "used for SearXena and voice recognition (Vosk)."
  LangString FINISH 1033 "🎉 Everything ready. Finalizing file copy..."

  ; Chinese (2052)
  LangString INSTALL_START 2052 "🚀 正在启动 MikuCentral v2.4.0 的安装"
  LangString INSTALL_SUBTITLE 2052 "🌟 您的 Windows 个人 AI 助手"
  LangString TIP_ONBOARDING 2052 "提示：启动后，新手引导将逐步引导您。"
  LangString TIP_LEARN 2052 "MikuCentral 可以了解您，从而变得极具针对性。"
  LangString PHASE_1 2052 "🔍 阶段 1：验证系统要求..."
  LangString CHECK_GIT 2052 "正在检查开发工具 (Git)..."
  LangString WARN_GIT 2052 "警告：未检测到 Git。克隆仓库需要用到它。"
  LangString MSG_GIT 2052 "克隆仓库和在工作区中使用高级命令引擎需要用到 Git。$\r$\n您的系统中未检测到 Git。$\r$\n$\r$\n您现在要下载并安装 Git for Windows 吗？"
  LangString DESC_GIT 2052 "⬇️ 正在下载 Git for Windows..."
  LangString INST_GIT 2052 "🛠️ 正在以静默模式安装 Git..."
  LangString SUCCESS_GIT 2052 "✅ Git 安装成功。"
  LangString DETECT_GIT 2052 "✅ 已成功检测到 Git: $1"
  LangString TIP_TELEGRAM_1 2052 "建议：如果您想随时随地操作您的助手，"
  LangString TIP_TELEGRAM_2 2052 "请启用 Telegram 配对。"
  LangString CHECK_VC 2052 "正在检查系统库 (VC++ Redist)..."
  LangString WARN_VC 2052 "警告：缺少 Visual C++ 库。它们是 AI 模块必不可少的。"
  LangString MSG_VC 2052 "MikuCentral 需要 'Microsoft Visual C++ Redistributable 2015-2022' 才能在您的计算机上运行 AI 模块。$\r$\n未检测到该库。$\r$\n$\r$\n您现在要下载并安装它吗？（强烈建议）"
  LangString DESC_VC 2052 "⬇️ 正在下载 VC++ Redistributable x64..."
  LangString INST_VC 2052 "🛠️ 正在安装系统库...（静默安装）"
  LangString SUCCESS_VC 2052 "✅ 库已安装。"
  LangString DETECT_VC 2052 "✅ 已检测到 Visual C++ 库。"
  LangString INFO_PYTHON_1 2052 "ℹ️ MikuCentral 包含一个嵌入式 Python 3.11 引擎，"
  LangString INFO_PYTHON_2 2052 "用于 SearXena 和语音识别 (Vosk)。"
  LangString FINISH 2052 "🎉 准备就绪。正在完成文件复制..."
!macroend

; -------------------------------------------------------------------------
; 3. Pre-Install Section (Executes BEFORE app file extraction)
; -------------------------------------------------------------------------
Section "-PreInstallSection"
  SetDetailsView show
  
  DetailPrint "--------------------------------------------------------"
  DetailPrint "$(INSTALL_START)"
  DetailPrint "$(INSTALL_SUBTITLE)"
  DetailPrint "--------------------------------------------------------"
  DetailPrint "$(TIP_ONBOARDING)"
  DetailPrint "$(TIP_LEARN)"
  DetailPrint "--------------------------------------------------------"

  DetailPrint "$(PHASE_1)"
  Sleep 500

  ; 3.1. Check for Git
  DetailPrint "$(CHECK_GIT)"
  nsExec::ExecToStack 'cmd /c "git --version"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    DetailPrint "$(WARN_GIT)"
    MessageBox MB_YESNO|MB_ICONQUESTION "$(MSG_GIT)" IDNO skip_git
    
    DetailPrint "$(DESC_GIT)"
    nsExec::ExecToLog 'powershell.exe -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri https://github.com/git-for-windows/git/releases/download/v2.44.0.windows.1/Git-2.44.0-64-bit.exe -OutFile $PLUGINSDIR\GitSetup.exe"'
    
    DetailPrint "$(INST_GIT)"
    ExecWait '"$PLUGINSDIR\GitSetup.exe" /SILENT'
    DetailPrint "$(SUCCESS_GIT)"
    
    skip_git:
  ${Else}
    DetailPrint "$(DETECT_GIT)"
  ${EndIf}

  DetailPrint "--------------------------------------------------------"
  DetailPrint "$(TIP_TELEGRAM_1)"
  DetailPrint "$(TIP_TELEGRAM_2)"
  DetailPrint "--------------------------------------------------------"

  ; 3.2. Check for Visual C++
  DetailPrint "$(CHECK_VC)"
  ClearErrors
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  ${If} $0 != "1"
    DetailPrint "$(WARN_VC)"
    MessageBox MB_YESNO|MB_ICONQUESTION "$(MSG_VC)" IDNO skip_vcredist
    
    DetailPrint "$(DESC_VC)"
    nsExec::ExecToLog 'powershell.exe -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri https://aka.ms/vs/17/release/vc_redist.x64.exe -OutFile $PLUGINSDIR\vcredist_x64.exe"'
    
    DetailPrint "$(INST_VC)"
    ExecWait '"$PLUGINSDIR\vcredist_x64.exe" /install /quiet /norestart'
    DetailPrint "$(SUCCESS_VC)"
    
    skip_vcredist:
  ${Else}
    DetailPrint "$(DETECT_VC)"
  ${EndIf}

  DetailPrint "--------------------------------------------------------"
  DetailPrint "$(INFO_PYTHON_1)"
  DetailPrint "$(INFO_PYTHON_2)"
  DetailPrint "--------------------------------------------------------"
  DetailPrint "$(FINISH)"
  
  ; This section ends, and then electron-builder's extraction section begins.
SectionEnd
