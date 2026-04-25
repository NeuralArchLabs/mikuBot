import sys
import json
import os
import re

# Forzar salida en utf-8 para evitar problemas con emojis en Windows
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

def normalize_name(name):
    """Removes non-alphanumeric characters and lowercases the name for robust matching."""
    return re.sub(r'[^a-z0-9]', '', str(name).lower())

def main():
    try:
        # Args passed as JSON string in first argument
        args = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
        target_tool = args.get('tool_name', '').strip()
        
        if not target_tool:
            print(json.dumps({"error": "You must provide a tool name (tool_name)."}))
            return

        target_norm = normalize_name(target_tool)

        # Localizar el archivo TOOL_USAGE_LIBRARY.md y TOOLS.MD
        current_dir = os.path.dirname(os.path.abspath(__file__))
        base_dir = os.path.dirname(os.path.dirname(current_dir))
        
        library_path = os.path.join(base_dir, 'TOOL_USAGE_LIBRARY.md')
        tools_path = os.path.join(base_dir, 'TOOLS.MD')
        
        if not os.path.exists(library_path):
            library_path = os.path.join(os.path.dirname(base_dir), 'TOOL_USAGE_LIBRARY.md')
        if not os.path.exists(tools_path):
            tools_path = os.path.join(os.path.dirname(base_dir), 'TOOLS.MD')

        result = {
            "tool": target_tool,
            "description": "No detailed description found in TOOLS.MD.",
            "manual_snippet": "No usage examples found in TOOL_USAGE_LIBRARY.md.",
            "note": "Ensure you follow exactly the parameter structure shown above if examples are provided."
        }
        
        found_any = False

        # 1. Extraer descripción de TOOLS.MD
        if os.path.exists(tools_path):
            with open(tools_path, 'r', encoding='utf-8') as f:
                tools_content = f.read()
                
            # Split sections by ## or ###
            sections = re.split(r'\n(?=#{2,3}\s)', tools_content)
            desc_blocks = []
            for sec in sections:
                lines = sec.strip().split('\n')
                if not lines: continue
                heading = lines[0]
                heading_norm = normalize_name(heading)
                
                # Simple exact/contains match on normalized heading
                if target_norm in heading_norm and len(target_norm) > 2:
                    # Basic protection against matching too broadly (e.g. 'read' matching 'read_url' and 'read_file')
                    # We check if target_norm is isolated or is a substantial part
                    heading_words = [normalize_name(w) for w in re.split(r'[^a-zA-Z0-9]', heading) if w]
                    if target_norm in heading_words or target_norm == heading_norm.replace('tier', '').replace('basetool', '').replace('skill', ''):
                        desc_blocks.append(sec.strip())
                        continue
                        
                    # Also fallback if the raw string matches completely
                    if target_norm in heading_norm:
                        desc_blocks.append(sec.strip())
            
            if desc_blocks:
                result["description"] = "\n\n".join(desc_blocks)
                found_any = True

        # 2. Extraer snippet de JSON de TOOL_USAGE_LIBRARY.md
        if os.path.exists(library_path):
            with open(library_path, 'r', encoding='utf-8') as f:
                content = f.read()

            pattern = r"##\s*\[(.*?)\]\s*\r?\n([\s\S]*?)(?=\n##\s*\[|$)"
            all_blocks = re.findall(pattern, content)
            
            snippets = []
            for title, snippet in all_blocks:
                title_norm = normalize_name(title)
                # Split grouped commands like "recall — init"
                parts = re.split(r'\s+[—\-]\s+|\s+', title.strip(), 1)
                base_norm = normalize_name(parts[0])
                
                if title_norm == target_norm or base_norm == target_norm:
                    snippets.append(f"### [{title}]\n{snippet.strip()}")

            if snippets:
                result["manual_snippet"] = "\n\n".join(snippets)
                found_any = True

        # 3. Fallback a skills folder (usage.md) si no se encontró en las librerías base
        if not found_any or target_norm == "instructionbooklet":
            skills_dir = os.path.dirname(current_dir)
            if os.path.exists(skills_dir):
                for folder in os.listdir(skills_dir):
                    if normalize_name(folder) == target_norm:
                        usage_path = os.path.join(skills_dir, folder, 'usage.md')
                        if os.path.exists(usage_path):
                            with open(usage_path, 'r', encoding='utf-8') as f:
                                result["manual_snippet"] = f.read().strip()
                                result["description"] = f"Manual extracted from {folder}/usage.md."
                                found_any = True
                        break
        
        # 4. Caso especial para sí misma
        if target_norm == "instructionbooklet" and not found_any:
            result["description"] = "Tool to look up documentation and usage JSON examples for other tools/skills."
            result["manual_snippet"] = '{\n  "name": "instruction_booklet",\n  "arguments": {\n    "tool_name": "target_tool_name"\n  }\n}'
            found_any = True

        if not found_any:
            result = {
                "error": f"No manual or description found for the tool '{target_tool}'.",
                "suggestion": "Use 'list_available_skills' to verify the correct names of available tools, or check TOOLS.MD directly."
            }

        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
