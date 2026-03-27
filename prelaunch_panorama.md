# 🚀 MikuCentral Pre-launch Panorama

**Estado Actual:** Beta Avanzada / Pre-lanzamiento (v1.9.8)
**Objetivo:** Asegurar un lanzamiento seguro, escalable y con una experiencia de usuario premium para el público general.

## 🔍 Análisis de Riesgos y Seguridad

### 🔴 Crítico: Inyección de Comandos (Shell Injection)
- **Hallazgo:** El handler `run-console` en `main.cjs` utiliza `exec()` directamente sobre la entrada del agente. Sin validación estricta, un *prompt injection* podría ejecutar comandos destructivos en el sistema del usuario.
- **Acción Recomendada:** Implementar una lista blanca de comandos permitidos (whitelist) o aplicar filtros de expresiones regulares para caracteres de concatenación de comandos (`&&`, `;`, `|`).

### 🔴 Crítico: Salto de Directorio (Path Traversal)
- **Hallazgo:** Las operaciones de escritura y borrado nativas (`fs-write-file`, `fs-delete-file`) no validan exhaustivamente si el nombre del archivo contiene secuencias `../`. Existe riesgo de que el asistente modifique archivos fuera del sandbox configurado.
- **Acción Recomendada:** Normalizar todas las rutas con `path.resolve` y verificar que el subdirectorio resultante pertenezca siempre al `folderPath` raíz.

### 🟡 Medio: Privacidad de Credenciales
- **Hallazgo:** Las API Keys se almacenan en texto plano en `config.json`. Aunque es local, representa un riesgo de exposición accidental si el usuario comparte sus archivos de configuración.
- **Acción Recomendada:** Evaluar el uso de `safeStorage` de Electron para proteger las llaves de servicios (Gemini, Groq, Z.AI).

## 🏗️ Salud del Código y Escalabilidad

### 🟡 Medio: Monolitismo en frontend
- **Hallazgo:** `App.tsx` supera las 1700 líneas. Esto dificulta el mantenimiento a largo plazo y puede causar problemas de re-renderizado innecesarios en sesiones largas.
- **Acción Recomendada:** Modularizar la lógica del "Agent Loop" y separar los contextos de UI (Sidebar, Chat, Settings) en proveedores independientes.

### 🟢 Bajo: Integridad de Datos
- **Hallazgo:** El motor de persistencia `safeWriteJSON` es excelente. El uso de `fsyncSync` garantiza que no haya archivos de 0-bytes tras caídas del sistema.

## 🎨 Visión Artística y UX

### 🟢 Excelente: Estética Neural
- **Hallazgo:** Las animaciones "laser-draw" y el efecto typewriter sensible a HTML elevan la percepción de calidad de la herramienta frente a alternativas más técnicas.

### 🟡 Sugerencia: Onboarding de Pre-requisitos
- **Hallazgo:** La app depende de Python y motores externos. Un fallo en estos componentes puede frustrar al usuario no técnico.
- **Acción Recomendada:** Añadir una pantalla de comprobación de salud del entorno en el asistente inicial (Checklist de pre-requisitos).

---
*Este documento sirve como hoja de ruta para el blindaje final antes del primer release público.*
