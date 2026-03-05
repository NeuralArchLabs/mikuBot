# SearXNG en Windows

Guia para ejecutar SearXNG nativamente en Windows sin Docker ni WSL.

## Requisitos

- Python 3.10+ con "Add to PATH" marcado: https://www.python.org/downloads/
- Node.js 24+: https://nodejs.org/
- Visual C++ Build Tools: https://visualstudio.microsoft.com/visual-cpp-build-tools/
- PowerShell 5+ (incluido en Windows 10/11)

## Primera instalacion

Abrir PowerShell en la carpeta del proyecto:

    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
    .\win_setup.ps1

Eso es todo. El script crea el virtualenv, instala dependencias y compila el frontend.

## Iniciar SearXNG

    .\manage.ps1 webapp.run

Abre automaticamente http://127.0.0.1:8888/

## Comandos de manage.ps1

    webapp.run        Inicia el servidor de desarrollo
    pyenv.install     Crea/actualiza virtualenv Python
    pyenv.uninstall   Desinstala searxng del virtualenv
    py.clean          Elimina virtualenv y .pyc
    node.env          Instala dependencias npm
    node.env.dev      Instala herramientas npm dev
    node.clean        Elimina node_modules
    themes.build      Compila temas CSS/JS con Vite
    format.python     Formatea codigo con black
    test              Ejecuta tests unitarios
    help              Muestra ayuda

## Inicio manual

    .\local\py3\Scripts\Activate.ps1
    granian --interface wsgi --host 127.0.0.1 --port 8888 --reload searx.webapp:app

## Configuracion

Editar searx\settings.yml:

    server:
      port: 8888
      bind_address: 127.0.0.1
      secret_key: cambia-esto-en-produccion

## Valkey (opcional)

Valkey/Redis es opcional. SearXNG funciona sin el.
Si lo instalas, configura en settings.yml:

    valkey:
      url: valkey://localhost:6379/0

Descarga: https://github.com/valkey-io/valkey/releases

## Problemas comunes

Error de scripts deshabilitados:
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

Error compilando lxml o fasttext:
    Instalar Visual C++ Build Tools, opcion Desktop development with C++

Puerto 8888 ocupado:
    Cambiar port en settings.yml o usar $env:GRANIAN_PORT = 9999

## Diferencias Linux vs Windows

    Linux                              Windows
    ./manage webapp.run                .\manage.ps1 webapp.run
    local/py3/bin/python               local\py3\Scripts\python.exe
    source local/py3/bin/activate      .\local\py3\Scripts\Activate.ps1
    xdg-open http://...                Start-Process http://...
