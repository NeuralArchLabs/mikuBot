!include "LogicLib.nsh"

!macro customInstall
  DetailPrint "--------------------------------------------------------"
  DetailPrint "🚀 Iniciando la instalación de MikuCentral v2.1.4"
  DetailPrint "🌟 Tu Asistente de IA Personal para Windows"
  DetailPrint "--------------------------------------------------------"
  DetailPrint "CONSEJO: Al iniciar, el Onboarding te guiará paso a paso."
  DetailPrint "MikuCentral puede aprender sobre ti para ser hiper-específica."
  DetailPrint "--------------------------------------------------------"

  DetailPrint "🔍 Fase 1: Verificando requisitos del sistema..."
  Sleep 1000

  ; 1. Check for Ollama (Local AI Engine)
  DetailPrint "Comprobando motor de IA local (Ollama)..."
  nsExec::ExecToStack 'cmd /c "ollama --version"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    DetailPrint "AVISO: Ollama no detectado. Se requiere para inferencia 100% privada."
    MessageBox MB_YESNO|MB_ICONQUESTION "MikuCentral utiliza Ollama para ejecutar modelos neuronales locales de forma segura en tu dispositivo.$\r$\nOllama no fue detectado en tu sistema.$\r$\n$\r$\n¿Deseas descargar e instalar Ollama ahora mismo? (Recomendado)" IDNO skip_ollama
    
    DetailPrint "⬇️ Descargando Ollama Setup (esto puede tardar unos minutos)..."
    nsExec::ExecToLog 'powershell.exe -Command "Invoke-WebRequest -Uri https://ollama.com/download/OllamaSetup.exe -OutFile $PLUGINSDIR\OllamaSetup.exe"'
    
    DetailPrint "🛠️ Ejecutando instalador de Ollama. Sigue las instrucciones en pantalla..."
    ExecWait '"$PLUGINSDIR\OllamaSetup.exe"'
    DetailPrint "✅ Ollama procesado."
    
    skip_ollama:
  ${Else}
    DetailPrint "✅ Ollama detectado correctamente: $1"
  ${EndIf}

  DetailPrint "--------------------------------------------------------"
  DetailPrint "TIP DE USO: Prueba el 'Modo Seguro' si quieres autorizar"
  DetailPrint "cada acción técnica que realice el asistente."
  DetailPrint "--------------------------------------------------------"

  ; 2. Check for Git (Workspace / Repositories)
  DetailPrint "Comprobando herramientas de desarrollo (Git)..."
  nsExec::ExecToStack 'cmd /c "git --version"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    DetailPrint "AVISO: Git no detectado. Es necesario para clonar repositorios."
    MessageBox MB_YESNO|MB_ICONQUESTION "Git es necesario para clonar repositorios y utilizar el motor de comandos avanzado en Workspaces.$\r$\nGit no fue detectado en tu sistema.$\r$\n$\r$\n¿Deseas descargar e instalar Git for Windows ahora?" IDNO skip_git
    
    DetailPrint "⬇️ Descargando Git for Windows..."
    nsExec::ExecToLog 'powershell.exe -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri https://github.com/git-for-windows/git/releases/download/v2.44.0.windows.1/Git-2.44.0-64-bit.exe -OutFile $PLUGINSDIR\GitSetup.exe"'
    
    DetailPrint "🛠️ Instalando Git en modo silencioso..."
    ExecWait '"$PLUGINSDIR\GitSetup.exe" /SILENT'
    DetailPrint "✅ Git instalado correctamente."
    
    skip_git:
  ${Else}
    DetailPrint "✅ Git detectado correctamente: $1"
  ${EndIf}

  DetailPrint "--------------------------------------------------------"
  DetailPrint "RECOMENDACIÓN: Activa la vinculación con Telegram si"
  DetailPrint "quieres operar tu asistente 24/7 desde cualquier lugar."
  DetailPrint "--------------------------------------------------------"

  ; 3. Check for Visual C++ Redistributable 2015-2022 (x64)
  DetailPrint "Comprobando librerías de sistema (VC++ Redist)..."
  ClearErrors
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  ${If} $0 != "1"
    DetailPrint "AVISO: Librerías Visual C++ faltantes. Son obligatorias para la IA."
    MessageBox MB_YESNO|MB_ICONQUESTION "MikuCentral requiere 'Microsoft Visual C++ Redistributable 2015-2022' para los módulos de IA en tu equipo.$\r$\nNo fue detectado.$\r$\n$\r$\n¿Deseas descargarlo e instalarlo ahora? (Altamente Recomendado)" IDNO skip_vcredist
    
    DetailPrint "⬇️ Descargando VC++ Redistributable x64..."
    nsExec::ExecToLog 'powershell.exe -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri https://aka.ms/vs/17/release/vc_redist.x64.exe -OutFile $PLUGINSDIR\vcredist_x64.exe"'
    
    DetailPrint "🛠️ Instalando librerías del sistema... (Instalación silenciosa)"
    ExecWait '"$PLUGINSDIR\vcredist_x64.exe" /install /quiet /norestart'
    DetailPrint "✅ Librerías instaladas."
    
    skip_vcredist:
  ${Else}
    DetailPrint "✅ Librerías Visual C++ detectadas."
  ${EndIf}

  DetailPrint "--------------------------------------------------------"
  DetailPrint "ℹ️ MikuCentral incluye un motor Python 3.11 embebido"
  DetailPrint "   utilizado para SearXena y reconocimiento de voz (Vosk)."
  DetailPrint "--------------------------------------------------------"
  DetailPrint "🎉 Todo listo. Finalizando la copia de archivos..."
  Sleep 1000
!macroend
