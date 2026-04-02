# Embedded Python Engine (MikuCentral)

## Overview

This directory contains a complete Python 3.11 embedded distribution that serves as the **general Python motor** for MikuCentral. It is used by all internal Python-based features including SearXena, voice recognition, and skill execution.

## Structure

```
engine/
├── python/                    ← Embedded Python (general motor)
│   ├── python.exe            # Main Python executable
│   ├── pythonw.exe           # Python without console
│   ├── python311.dll
│   ├── python311.zip         # Standard library
│   ├── *.pyd                 # Compiled modules
│   ├── *.dll                 # Required DLLs
│   ├── python311._pth        # Python path configuration
│   ├── get-pip.py            # Pip installer
│   ├── Lib/                  # Shared packages (pip, virtualenv)
│   │   └── site-packages/
│   └── Scripts/              # Executable scripts
└── searXena/                 ← External project (DO NOT MODIFY)
    ├── core/
    ├── requirements.txt
    └── .venv/                ← SearXena's virtual environment (created at runtime)
        ├── Scripts/
        │   └── python.exe
        └── Lib/
            └── site-packages/  # SearXena's isolated dependencies
```

## How it works

1. **Embedded Python** (`engine/python/`) - Packaged with the app, contains:
   - Python 3.11.9 interpreter
   - Base packages: pip, setuptools, virtualenv
   - Shared utilities used by multiple features

2. **SearXena venv** (`engine/searXena/.venv/`) - Created at runtime:
   - Uses embedded Python as bootstrap
   - Contains SearXena-specific dependencies
   - Can be recreated/updated without affecting the embedded Python
   - Located inside SearXena directory (doesn't pollute project structure)

## Usage

### For SearXena

SearXena's venv is automatically created when:
1. User installs the app for the first time
2. User clicks "Sync Dependencies" in Settings
3. App detects missing venv at startup

The venv is created using:
```powershell
engine\python\python.exe -m virtualenv searXena\.venv
```

### For Other Features

Voice recognition, skills, and other Python-based features can use:
- The embedded Python directly (`engine/python/python.exe`)
- Or create their own isolated environments if needed

## Updating the Embedded Python

To update the embedded Python distribution:

1. Download new Python embeddable from https://www.python.org/downloads/
2. Extract to a temporary location
3. Replace contents of `engine/python/`
4. Test by running `python.exe --version`
5. Reinstall base packages: `python.exe get-pip.py`
6. Reinstall virtualenv: `python.exe -m pip install virtualenv`

## Troubleshooting

### Python not found

If the app reports Python not found:
- Verify `engine/python/python.exe` exists
- Check that it can be executed: `python.exe --version`

### venv creation fails

If venv creation fails:
- Check that `virtualenv` is installed: `python.exe -m pip list | findstr virtualenv`
- Reinstall if needed: `python.exe -m pip install virtualenv`

### Dependencies not installing

If dependencies fail to install:
- Check internet connection
- Verify requirements.txt exists in SearXena directory
- Try manual install: `.venv\Scripts\python.exe -m pip install -r requirements.txt`

## Version

- Python: 3.11.9
- Virtualenv: 21.2.0
- Pip: 26.0.1

Python 3.11 was chosen for its balance of stability and performance, and wide compatibility with all required dependencies.
