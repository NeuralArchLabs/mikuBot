import sys
import json
import os

def main():
    try:
        # En el entorno de MikuCentral, las skills están en una carpeta 'skills' 
        # hermana o cercana. Pero como esta skill corre desde su propia carpeta,
        # subimos dos niveles para ver a sus hermanas.
        
        # Intentamos localizar la ruta de skills dinámicamente
        current_dir = os.path.dirname(os.path.abspath(__file__))
        skills_root = os.path.dirname(current_dir)
        
        skills_list = []
        
        if os.path.exists(skills_root):
            for folder in os.listdir(skills_root):
                folder_path = os.path.join(skills_root, folder)
                if os.path.isdir(folder_path):
                    manifest_path = os.path.join(folder_path, 'manifest.json')
                    if os.path.exists(manifest_path):
                        with open(manifest_path, 'r', encoding='utf-8') as f:
                            manifest = json.load(f)
                            skills_list.append({
                                "name": manifest.get("name"),
                                "description": manifest.get("description")
                            })

        result = {
            "available_skills": skills_list,
            "count": len(skills_list),
            "usage_tip": "To use one of these skills, simply call it by its function name with the required parameters."
        }
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
