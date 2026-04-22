import sys
import json
import os
import subprocess
import shutil

def get_workspace_root():
    # Attempt to locate the root workspace
    # Given this is in mikuCentralv1.0/core/base/skills/dynamic_widgets
    script_dir = os.path.dirname(os.path.abspath(__file__))
    parts = script_dir.replace('\\', '/').split('/')
    try:
        core_index = parts.index('core')
        root_path = "/".join(parts[:core_index])
        return root_path
    except ValueError:
        # Fallback to CWD
        return os.getcwd()

def get_data_root():
    env_root = os.environ.get('MIKU_WORKSPACE_ROOT')
    if env_root and os.path.exists(env_root):
        return env_root
    return get_workspace_root()

def get_widgets_dir():
    root = get_data_root()
    w_dir = os.path.join(root, "dynamic_widgets")
    if not os.path.exists(w_dir):
        os.makedirs(w_dir, exist_ok=True)
    return w_dir

def get_app_executable():
    root = get_workspace_root()
    
    # 1. Production Package Native App Check
    prod_exe = os.path.join(root, "MikuCentral.exe")
    if os.path.exists(prod_exe):
        return prod_exe
        
    # 2. Local Dev Check
    if sys.platform == 'win32':
        return os.path.join(root, "node_modules", "electron", "dist", "electron.exe")
    elif sys.platform == 'darwin':
        return os.path.join(root, "node_modules", "electron", "dist", "Electron.app", "Contents", "MacOS", "Electron")
    else:
        return os.path.join(root, "node_modules", "electron", "dist", "electron")

def spawn_detached(command):
    # Spawn a detached process without a visible command prompt window
    try:
        creation_flags = 0
        if sys.platform == 'win32':
            # DETACHED_PROCESS (0x00000008) + CREATE_NO_WINDOW (0x08000000)
            creation_flags = 0x08000008
        
        # We no longer use shell=True since we are calling the binary directly
        p = subprocess.Popen(command, shell=False, creationflags=creation_flags, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return p.pid
    except Exception as e:
        return str(e)

def main():
    try:
        if len(sys.argv) < 2:
            print(json.dumps({"error": "Missing arguments JSON string."}))
            return

        try:
            args = json.loads(sys.argv[1])
        except Exception as e:
            print(json.dumps({"error": f"Failed to parse arguments: {str(e)}", "raw": sys.argv[1]}))
            return
            
        action = args.get('action')
        widget_id = args.get('widget_id')
        
        widgets_dir = get_widgets_dir()
        script_dir = os.path.dirname(os.path.abspath(__file__))
        
        if action == "list":
            files = [f for f in os.listdir(widgets_dir) if f.endswith('.html')]
            result = []
            for f in files:
                filepath = os.path.join(widgets_dir, f)
                try:
                    with open(filepath, 'r', encoding='utf-8') as file:
                        content = file.read()
                        # Extract some basic config if we stored it as comments or just return name
                        result.append(f.replace('.html', ''))
                except:
                    result.append(f.replace('.html', ''))
                    
            print(json.dumps({"status": "success", "widgets": result}))
            return
            
        elif action == "delete":
            if not widget_id:
                print(json.dumps({"error": "widget_id is required."}))
                return
            filepath = os.path.join(widgets_dir, f"{widget_id}.html")
            if os.path.exists(filepath):
                os.remove(filepath)
                
                # Also delete config if exists
                config_path = os.path.join(widgets_dir, f"{widget_id}.json")
                if os.path.exists(config_path):
                    os.remove(config_path)
                    
                print(json.dumps({"status": "success", "message": f"Widget {widget_id} deleted."}))
            else:
                print(json.dumps({"error": "Widget not found."}))
            return
            
        elif action == "create":
            if not widget_id:
                print(json.dumps({"error": "widget_id is required."}))
                return
                
            html_content = args.get('html_content', '')
            width = args.get('width', 300)
            height = args.get('height', 300)
            always_on_top = args.get('always_on_top', True)
            description = args.get('description', 'HTML Component')
            
            # Save HTML
            filepath = os.path.join(widgets_dir, f"{widget_id}.html")
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(html_content)
                
            # Save config to make it stateful for launching later
            config = {
                "id": widget_id, "width": width, "height": height, "alwaysOnTop": always_on_top, "description": description
            }
            config_path = os.path.join(widgets_dir, f"{widget_id}.json")
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(config, f)
                
            # Optionally launch it immediately
            cmd = [get_app_executable(), '--dynamic-widget', filepath]
            pid = spawn_detached(cmd)
            
            print(json.dumps({"status": "success", "message": f"Widget {widget_id} created and launched.", "pid": pid}))
            return
            
        elif action == "launch":
            if not widget_id:
                print(json.dumps({"error": "widget_id is required."}))
                return
                
            filepath = os.path.join(widgets_dir, f"{widget_id}.html")
            if not os.path.exists(filepath):
                print(json.dumps({"error": f"Widget {widget_id} does not exist. Use create first."}))
                return
                
            cmd = [get_app_executable(), '--dynamic-widget', filepath]
            pid = spawn_detached(cmd)
            
            print(json.dumps({"status": "success", "message": f"Widget {widget_id} launched.", "pid": pid}))
            return
            
        elif action == "open_manager":
            cmd = [get_app_executable(), '--dynamic-widget-manager', widgets_dir]
            pid = spawn_detached(cmd)
            print(json.dumps({"status": "success", "message": "Widget Manager started.", "pid": pid}))
            return

        elif action == "read_code":
            if not widget_id:
                print(json.dumps({"error": "widget_id is required."}))
                return
            filepath = os.path.join(widgets_dir, f"{widget_id}.html")
            if not os.path.exists(filepath):
                print(json.dumps({"error": f"Widget {widget_id} does not exist."}))
                return
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                print(json.dumps({"status": "success", "html_content": content}))
            except Exception as e:
                print(json.dumps({"error": f"Failed to read widget: {str(e)}"}))
            return

        elif action == "update_code":
            if not widget_id:
                print(json.dumps({"error": "widget_id is required."}))
                return
            html_content = args.get('html_content')
            if html_content is None:
                print(json.dumps({"error": "html_content is required for update_code."}))
                return
            filepath = os.path.join(widgets_dir, f"{widget_id}.html")
            if not os.path.exists(filepath):
                print(json.dumps({"error": f"Widget {widget_id} does not exist. Use create instead."}))
                return
            try:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(html_content)
                print(json.dumps({"status": "success", "message": f"Widget {widget_id}.html updated successfully."}))
            except Exception as e:
                print(json.dumps({"error": f"Failed to update widget: {str(e)}"}))
            return

        else:
            print(json.dumps({"error": f"Unknown action: {action}"}))
            return

    except Exception as e:
        print(json.dumps({"error": f"Unexpected skill error: {str(e)}"}))

if __name__ == "__main__":
    main()
