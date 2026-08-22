# Ollama Multi-GPU PTX Crash — Fix Universal

> **TL;DR**: Si Ollama crashea con `exit status 0xc0000409` (stack buffer overrun) + `CUDA error: the provided PTX was compiled with an unsupported toolchain`, y la máquina tiene GPUs mezcladas (ej: RTX moderna + GTX vieja), el problema es que Ollama reparte capas del modelo entre GPUs incompatibles. La solución es aislar la GPU compatible con `CUDA_VISIBLE_DEVICES` **inyectándola en el entorno del proceso**, no solo con `setx`.

---

## El problema

### Síntomas

```
❌ llama-server process has terminated: exit status 0xc0000409
   The system detected an overrun of a stack-based buffer in this application.
❌ CUDA error: the provided PTX was compiled with an unsupported toolchain.
   ggml-cuda.cu:104: CUDA error
```

Ollama reintentará la carga varias veces, agotará el timeout de 5 minutos, y la app que lo consume verá timeouts o caerá al fallback.

### Causa raíz

Ollama (via llama.cpp) detecta **todas** las GPUs CUDA disponibles y, por defecto, **reparte las capas del modelo entre ellas** para maximizar VRAM:

```
load_tensors:        CUDA0 model buffer size = 1784.77 MiB   ← GPU nueva
load_tensors:        CUDA1 model buffer size =  582.77 MiB   ← GPU vieja (crash)
```

Si una de las GPUs tiene una arquitectura que CUDA 12.x ya no soporta correctamente en runtime (aunque declare soporte PTX), los kernels crashean al ejecutarse, corrompen el stack, y Windows mata el proceso.

### GPUs problemáticas

Cualquier GPU con **compute capability < 6.0**:

| Arquitectura | Compute | ¿CUDA 12.x PTX? | GPUs comunes |
|---|---|---|---|
| **Maxwell** | 5.0 / 5.2 | ⚠️ Crash en runtime | GTX 9xx series, GTX Titan X |
| **Kepler** | 3.x / 3.5 | ❌ Deprecado | GTX 6xx, GTX 7xx |
| **Pascal** | 6.0 / 6.1 | ✅ OK | GTX 10xx |
| **Turing** | 7.5 | ✅ OK | RTX 20xx, GTX 16xx |
| **Ampere** | 8.6 | ✅ OK | RTX 30xx |
| **Ada Lovelace** | 8.9 | ✅ OK | RTX 40xx |

Aunque llama.cpp compila PTX para `ARCHS=500,520,...`, hay un **bug en runtime** donde Maxwell (5.x) crashea con los toolchains modernos. No es un problema de "no soportado" — es un crash silencioso que corrompe memoria.

---

## La solución

### Por qué `main_gpu` no funciona

Ollama acepta `main_gpu` en el body de `/api/chat`:

```json
{ "options": { "main_gpu": 0 } }
```

Pero esto **solo indica qué GPU es la "principal" para el offload de capas**. No evita que Ollama reparta capas adicionales en las demás GPUs visibles. El crash ocurre igual.

### Por qué `setx` solo no funciona

```cmd
setx CUDA_VISIBLE_DEVICES 0
```

Esto escribe la variable en el registro de Windows (`HKCU\Environment`), pero **los procesos en ejecución no releen el registro**. Si tu app hace `spawn("ollama")`, el proceso hijo **hereda el entorno del proceso padre** (tu app), que se lanzó antes de que existiera la variable. Ollama nunca la ve.

### La solución correcta: inyectar `env` en el `spawn`

```javascript
const { spawn } = require('child_process');

// Aislar GPU 0 (la compatible) — la otra desaparece de CUDA
const childEnv = { ...process.env };
childEnv.CUDA_VISIBLE_DEVICES = '0';

const child = spawn(ollamaPath, [], {
    detached: true,
    stdio: 'ignore',
    env: childEnv   // ← CRÍTICO
});
child.unref();
```

Con esto, Ollama **solo ve una GPU CUDA**. No hay reparto posible. No hay crash.

### Verificación

Los logs de Ollama deben mostrar una sola GPU CUDA:

```
✅ inference compute id=0 library=CUDA compute=7.5 name=CUDA0 description="NVIDIA GeForce RTX 2070"
```

La GPU problemática puede seguir apareciendo como `Vulkan0`, pero **no se usará para inferencia CUDA** (Ollama prioriza CUDA sobre Vulkan).

```
⚠️ inference compute id=0 library=Vulkan compute=0.0 name=Vulkan0 description="NVIDIA GeForce GTX 960"
```

---

## Cómo aplicarlo en otros proyectos

### Escenario A: Tu app lanza Ollama

Si tu aplicación es responsable de iniciar el proceso de Ollama, aplica el patrón de `env` inyectado en el `spawn`. No necesitas `setx`.

```javascript
async function launchOllama(gpuIndex) {
    // Matar procesos existentes
    try { await exec('taskkill /F /IM "ollama app.exe"'); } catch {}
    try { await exec('taskkill /F /IM "ollama.exe"'); } catch {}
    await sleep(1500);

    const childEnv = { ...process.env };
    if (gpuIndex !== null && gpuIndex !== undefined) {
        childEnv.CUDA_VISIBLE_DEVICES = String(gpuIndex);
    } else {
        delete childEnv.CUDA_VISIBLE_DEVICES;
    }

    const child = spawn(ollamaPath, [], {
        detached: true,
        stdio: 'ignore',
        env: childEnv
    });
    child.unref();
}
```

### Escenario B: Tu app NO lanza Ollama (conecta por API)

Si tu app solo consume la API HTTP de Ollama y el usuario gestiona Ollama por su cuenta, necesitas una solución diferente:

**Opción 1 — Script de arranque para el usuario:**
```cmd
@echo off
set CUDA_VISIBLE_DEVICES=0
"%LOCALAPPDATA%\Programs\Ollama\ollama app.exe"
```

**Opción 2 — Detección + advertencia en la app:**
Detectar GPUs vía `nvidia-smi` y, si encuentras una con compute < 6.0, mostrar una advertencia al usuario con instrucciones de cómo aislar la GPU.

**Opción 3 — Si tienes permisos para reiniciar el servicio:**
```cmd
setx CUDA_VISIBLE_DEVICES 0
taskkill /F /IM "ollama app.exe"
taskkill /F /IM "ollama.exe"
:: Reabrir Ollama (debe heredar el nuevo entorno)
start "" "%LOCALAPPDATA%\Programs\Ollama\ollama app.exe"
```
> Nota: `start` desde una sesión nueva SÍ hereda las variables del registro. El problema es solo cuando relanzas desde un proceso padre con entorno stale.

### Detección de compute capability (reutilizable)

```javascript
const { stdout } = await execPromise(
    'nvidia-smi --query-gpu=index,name,memory.total,compute_cap --format=csv,noheader,nounits'
);

stdout.trim().split('\n').forEach(line => {
    const [index, name, mem, computeCap] = line.split(',').map(s => s.trim());
    const cc = parseFloat(computeCap);
    const compatible = cc >= 6.0;  // false = Maxwell/Kepler = crash PTX
    // index = GPU index para CUDA_VISIBLE_DEVICES
});
```

---

## Resumen

| Enfoque | ¿Funciona? | Por qué |
|---|---|---|
| `main_gpu` en API body | ❌ | No evita el reparto de capas |
| `setx` + relanzar desde app | ❌ | Proceso hijo hereda entorno stale del padre |
| `setx` + relanzar desde nueva sesión | ⚠️ | Funciona, pero frágil y depende del launcher |
| **`env` inyectado en `spawn`** | **✅** | El proceso hijo recibe la variable garantizado |

---

*Documentado tras implementar y validar este fix en mikuBot. El aislamiento de GPU se verificó en vivo: 35/35 capas cargadas en RTX 2070, cero crashes PTX, GTX 960 excluida del pipeline CUDA.*