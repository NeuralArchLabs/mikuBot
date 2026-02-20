!include "LogicLib.nsh"

!macro customInstall
  DetailPrint "Checking system requirements..."

  ; 1. Check for Ollama (Local AI Engine)
  nsExec::ExecToStack 'cmd /c "ollama --version"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    MessageBox MB_YESNO|MB_ICONQUESTION "MikuCentral utiliza Ollama para ejecutar modelos neuronales locales de forma segura en tu dispositivo.$\r$\nOllama no fue detectado en tu sistema.$\r$\n$\r$\n¿Deseas descargar e instalar Ollama ahora mismo? (Recomendado)" IDNO skip_ollama
    
    DetailPrint "Descargando Ollama..."
    nsExec::ExecToLog 'powershell.exe -Command "Invoke-WebRequest -Uri https://ollama.com/download/OllamaSetup.exe -OutFile $PLUGINSDIR\OllamaSetup.exe"'
    
    DetailPrint "Ejecutando instalador de Ollama..."
    ExecWait '"$PLUGINSDIR\OllamaSetup.exe"'
    
    skip_ollama:
  ${Else}
    DetailPrint "Ollama detectado correctamente."
  ${EndIf}

  ; 2. Check for Git (Workspace / Repositories)
  nsExec::ExecToStack 'cmd /c "git --version"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    MessageBox MB_YESNO|MB_ICONQUESTION "Git es necesario para clonar repositorios y utilizar el motor de comandos avanzado en Workspaces.$\r$\nGit no fue detectado en tu sistema.$\r$\n$\r$\n¿Deseas descargar e instalar Git for Windows ahora?" IDNO skip_git
    
    DetailPrint "Descargando Git..."
    nsExec::ExecToLog 'powershell.exe -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri https://github.com/git-for-windows/git/releases/download/v2.44.0.windows.1/Git-2.44.0-64-bit.exe -OutFile $PLUGINSDIR\GitSetup.exe"'
    
    DetailPrint "Ejecutando instalador de Git..."
    ExecWait '"$PLUGINSDIR\GitSetup.exe" /SILENT'
    
    skip_git:
  ${Else}
    DetailPrint "Git detectado correctamente."
  ${EndIf}

  ; 3. Check for Visual C++ Redistributable 2015-2022 (x64)
  ClearErrors
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  ${If} $0 != "1"
    MessageBox MB_YESNO|MB_ICONQUESTION "MikuCentral requiere 'Microsoft Visual C++ Redistributable 2015-2022' para los módulos de IA en tu equipo.$\r$\nNo fue detectado.$\r$\n$\r$\n¿Deseas descargarlo e instalarlo ahora? (Altamente Recomendado)" IDNO skip_vcredist
    
    DetailPrint "Descargando Visual C++ Redistributable..."
    nsExec::ExecToLog 'powershell.exe -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri https://aka.ms/vs/17/release/vc_redist.x64.exe -OutFile $PLUGINSDIR\vcredist_x64.exe"'
    
    DetailPrint "Instalando Visual C++ Redistributable..."
    ExecWait '"$PLUGINSDIR\vcredist_x64.exe" /install /quiet /norestart'
    
    skip_vcredist:
  ${Else}
    DetailPrint "Visual C++ Redistributable detectado correctamente."
  ${EndIf}

!macroend
