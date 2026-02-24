import sys
import json
import os
import re

def main():
    try:
        # Args passed as JSON string in first argument
        args = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
        target_tool = args.get('tool_name', '').lower().strip()
        
        if not target_tool:
            print(json.dumps({"error": "Debe proporcionar el nombre de una herramienta (tool_name)."}))
            return

        # Localizar el archivo TOOL_USAGE_LIBRARY.md
        # Subimos dos niveles desde core/base/skills/instruction_booklet/
        current_dir = os.path.dirname(os.path.abspath(__file__))
        base_dir = os.path.dirname(os.path.dirname(current_dir))
        library_path = os.path.join(base_dir, 'TOOL_USAGE_LIBRARY.md')
        
        if not os.path.exists(library_path):
            # Fallback a la raíz si no está en base_dir (por si acaso)
            library_path = os.path.join(os.path.dirname(base_dir), 'TOOL_USAGE_LIBRARY.md')

        if not os.path.exists(library_path):
            print(json.dumps({"error": f"No se encontró el archivo de referencia en {library_path}"}))
            return

        with open(library_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Buscar el bloque ## [tool_name]
        # Regex para capturar el contenido entre el encabezado de la herramienta y el siguiente encabezado o fin de archivo
        pattern = rf"##\s*\[{re.escape(target_tool)}\]\s*\r?\n([\s\S]*?)(?=\n##|$)"
        match = re.search(pattern, content, re.IGNORECASE)

        if match:
            snippet = match.group(1).strip()
            result = {
                "tool": target_tool,
                "manual_snippet": snippet,
                "note": "Asegúrate de seguir exactamente la estructura de parámetros mostrada arriba."
            }
        else:
            # Si no está en el core, buscar en las carpetas de skills por usage.md
            skills_dir = os.path.dirname(current_dir)
            skill_usage_found = False
            
            skill_folder = os.path.join(skills_dir, target_tool)
            usage_path = os.path.join(skill_folder, 'usage.md')
            
            if os.path.exists(usage_path):
                with open(usage_path, 'r', encoding='utf-8') as f:
                    snippet = f.read().strip()
                    result = {
                        "tool": target_tool,
                        "manual_snippet": snippet,
                        "note": "Manual extraído del archivo de uso de la skill."
                    }
                    skill_usage_found = True

            if not skill_usage_found:
                # Buscar skills dinámicamente si el nombre de la carpeta no coincide exactamente
                for folder in os.listdir(skills_dir):
                    if folder.lower() == target_tool.lower():
                        u_path = os.path.join(skills_dir, folder, 'usage.md')
                        if os.path.exists(u_path):
                            with open(u_path, 'r', encoding='utf-8') as f:
                                result = {
                                    "tool": target_tool,
                                    "manual_snippet": f.read().strip(),
                                    "note": "Manual extraído del archivo de uso de la skill."
                                }
                                skill_usage_found = True
                                break

            if not skill_usage_found:
                result = {
                    "error": f"No se encontró un manual para la herramienta '{target_tool}'.",
                    "suggestion": "Usa 'list_available_skills' para verificar los nombres correctos de las herramientas disponibles."
                }

        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
