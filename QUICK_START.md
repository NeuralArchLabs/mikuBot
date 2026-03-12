# 🚀 QUICK START - Nuevas Neural Skills

## Instalación de Dependencias (Una sola vez)

### Dependencias Nuevas Requeridas
```bash
# En tu ambiente Python
pip install psutil requests
```

## Verificar que todo funciona

```bash
# Listar todas las skills disponibles
call_skill("list_available_skills")
```

Deberías ver 17 skills disponibles incluyendo las nuevas.

---

## 📚 Ejemplos Inmediatos

### 1️⃣ Explorar Proyecto

```
Quiero entender la estructura de mi proyecto:

→ get_project_tree(path="./src", depth=2)
```

**Resultado:** Árbol visual del proyecto

---

### 2️⃣ Leer Archivo Grande

```
Necesito ver líneas específicas de un archivo:

→ read_file(
    path="./src/services/api.ts",
    start_line=50,
    end_line=100
)
```

**Resultado:** Solo las 50 líneas que necesitas

---

### 3️⃣ Buscar Código

```
Quiero encontrar todas las referencias a "useState":

→ search_files(
    query="useState",
    path="./src",
    file_pattern="*.tsx",
    recursive=true
)
```

**Resultado:** Lista de archivos y líneas con "useState"

---

### 4️⃣ Ver Estructura de Código

```
Quiero entender qué funciones/clases hay en un archivo:

→ file_outline(
    path="./src/components/App.tsx"
)
```

**Resultado:** Lista de componentes, funciones, etc.

---

### 5️⃣ Modificar Código Seguro

```
Necesito cambiar una línea específica:

→ smart_patch(
    path="./config.py",
    find="DEBUG = False",
    replace="DEBUG = True"
)
```

**Resultado:** Cambio realizado + backup automático

---

### 6️⃣ Ejecutar Comandos

```
Instalar dependencias:

→ run_command(
    command="npm install",
    cwd="./"
)
```

**Resultado:** Output del comando

---

### 7️⃣ Info del Sistema

```
Ver salud del sistema:

→ system_info(detailed=false)
```

**Resultado:**
```json
{
  "cpu": {"cores": 8, "percent": 45},
  "memory": {"used_gb": 8.5, "total_gb": 16},
  "uptime": "2 days, 5:30:00"
}
```

---

### 8️⃣ Git Status

```
Ver estado del repositorio:

→ git_info(info_type="status")
```

**Resultado:** Status, rama actual, commits recientes

---

### 9️⃣ Guardar Contexto

```
Guardar que la build fue exitosa:

→ project_memory(
    action="save",
    key="build_status",
    content="Build exitoso, 0 errores"
)
```

Después cargar:
```
→ project_memory(
    action="load",
    key="build_status"
)
```

---

### 🔟 Llamar API Externo

```
Obtener datos de una API:

→ http_request(
    url="https://api.github.com/users/octocat",
    method="GET"
)
```

**Resultado:** Status code + datos JSON

---

## 🎯 Flujo Completo: Revisar y Modificar Código

```
1. Entender proyecto
   → get_project_tree(path="./src", depth=2)

2. Listar archivos
   → list_files(path="./src", recursive=true, pattern="*.py")

3. Leer archivo
   → read_file(path="./src/main.py")

4. Buscar referencias
   → search_files(query="función_importante", path="./src")

5. Ver estructura
   → file_outline(path="./src/main.py")

6. Hacer cambio
   → smart_patch(
       path="./src/main.py",
       find="old_function()",
       replace="new_function()"
     )

7. Verificar cambio
   → read_file(path="./src/main.py", start_line=100, end_line=120)

8. Compilar/Testear
   → run_command(command="python -m pytest")

9. Verificar Git
   → git_info(info_type="status")

10. Guardar estado
    → project_memory(
        action="save",
        key="refactor_complete",
        content="Refactoring completado exitosamente"
      )
```

---

## 🆘 Solución de Problemas

### Error: "Archivo no encontrado"
**Solución:** Usa `list_files()` para ver qué archivos existen en esa ruta

### Error: "Bloque no encontrado" en smart_patch
**Solución:** El `find` debe ser EXACTO. Copia y pega el texto exacto incluyendo espacios

### Error: "Timeout en run_command"
**Solución:** Aumenta el timeout: `timeout=120`

### Error: "No es un repositorio Git"
**Solución:** Asegúrate de que hay un `.git/` en esa ruta

---

## 📖 Documentación Completa

Ver: `NEURAL_SKILLS_REFERENCE.md` para documentación detallada de cada skill

---

## ✅ Checklist de Verificación

- [ ] Instalé `pip install psutil requests`
- [ ] Ejecuté `list_available_skills()` y veo 17 skills
- [ ] Probé `get_project_tree()` en mi proyecto
- [ ] Probé `search_files()` para buscar algo
- [ ] Probé `smart_patch()` para cambiar algo (con backup)
- [ ] Probé `run_command()` para ejecutar un comando

**Si todo funciona → ¡Ya está listo! 🎉**

---

**Última actualización:** 2026-03-09  
**Versión:** Neural Skills v2.0
