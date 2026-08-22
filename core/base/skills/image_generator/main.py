import sys
import json
import base64
import os
import urllib.request
import urllib.parse
import urllib.error
import time
import io
import random

# Force stdout to use UTF-8
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

FREE_ENGINES = [
    {"name": "FLUX.1 Schnell", "model": "flux"},
    {"name": "FLUX Realism", "model": "flux-realism"},
    {"name": "SDXL Turbo", "model": "turbo"}
]

def generate_pollinations_image(prompt, aspect_ratio, number_of_images, model_type="flux"):
    # Map aspect ratio to pixels
    w, h = 1024, 1024
    if aspect_ratio == "16:9":
        w, h = 1280, 720
    elif aspect_ratio == "9:16":
        w, h = 720, 1280
    elif aspect_ratio == "4:3":
        w, h = 1024, 768
    elif aspect_ratio == "3:4":
        w, h = 768, 1024
        
    images_b64 = []
    encoded_prompt = urllib.parse.quote(prompt)
    
    for i in range(number_of_images):
        seed = random.randint(1000, 999999)
        url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={w}&height={h}&seed={seed}&nologo=true&model={model_type}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        
        with urllib.request.urlopen(req, timeout=35) as resp:
            img_bytes = resp.read()
            if not img_bytes or len(img_bytes) < 1000:
                raise Exception("La API devolvió un buffer de imagen vacío.")
            b64_str = base64.b64encode(img_bytes).decode('utf-8')
            images_b64.append(b64_str)
            
    return images_b64

def generate_with_fallback(prompt, requested_model, aspect_ratio, number_of_images):
    print(f"[ImageGenerator Debug] Solicitando generación: prompt='{prompt}', model='{requested_model}', aspect_ratio='{aspect_ratio}'", file=sys.stderr)
    engine_queue = []
    primary = None
    
    for eng in FREE_ENGINES:
        if eng["model"] == requested_model:
            primary = eng
            break
            
    if primary:
        engine_queue.append(primary)
        for eng in FREE_ENGINES:
            if eng["model"] != requested_model:
                engine_queue.append(eng)
    else:
        engine_queue = list(FREE_ENGINES)
        
    attempts_log = []
    
    for eng in engine_queue:
        engine_name = eng["name"]
        model_code = eng["model"]
        print(f"[ImageGenerator Debug] Intentando motor: {engine_name} ({model_code})...", file=sys.stderr)
        try:
            images = generate_pollinations_image(prompt, aspect_ratio, number_of_images, model_code)
            if images:
                print(f"[ImageGenerator Debug] ✅ Generación exitosa con motor: {engine_name}", file=sys.stderr)
                return {
                    "success": True,
                    "used_engine": engine_name,
                    "images": images,
                    "attempts": attempts_log
                }
        except Exception as e:
            print(f"[ImageGenerator Debug] ❌ Motor {engine_name} falló: {str(e)}", file=sys.stderr)
            attempts_log.append(f"Motor {engine_name} ({model_code}) -> Error: {str(e)}")
            
    return {
        "success": False,
        "error": "No se pudo generar la imagen con ningún motor gratuito disponible.",
        "attempts": attempts_log
    }

def main():
    try:
        args = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
        
        prompt = args.get("prompt")
        model = args.get("model", "flux")
        aspect_ratio = args.get("aspect_ratio", "1:1")
        number_of_images = args.get("numberOfImages", 1)
        mime_type = "image/png"
        
        if not prompt:
            print(json.dumps({"success": False, "error": "Falta el parámetro obligatorio 'prompt'."}, ensure_ascii=False))
            sys.exit(0)
            
        result = generate_with_fallback(prompt, model, aspect_ratio, number_of_images)
        
        if not result["success"]:
            print(json.dumps({
                "success": False,
                "error": result["error"],
                "attempts": result["attempts"]
            }, ensure_ascii=False))
            sys.exit(0)
            
        used_engine = result["used_engine"]
        generated_images = result["images"]
        
        # Save images into workspace directory
        workspace_root = os.environ.get("MIKU_WORKSPACE_ROOT", ".")
        output_dir_rel = "generated_images"
        output_dir_abs = os.path.join(workspace_root, output_dir_rel)
        os.makedirs(output_dir_abs, exist_ok=True)
        
        saved_files = []
        
        clean_prompt = "".join([c if c.isalnum() or c in " _-" else "" for c in prompt])[:35].strip().replace(" ", "_")
        if not clean_prompt:
            clean_prompt = "generation"
            
        for idx, img_bytes_b64 in enumerate(generated_images):
            img_bytes = base64.b64decode(img_bytes_b64)
            filename = f"miku_gen_{int(time.time())}_{clean_prompt}_{idx+1}.png"
            filepath_abs = os.path.join(output_dir_abs, filename)
            
            with open(filepath_abs, "wb") as f:
                f.write(img_bytes)
                
            saved_files.append(os.path.join(output_dir_rel, filename))
            
        output = {
            "success": True,
            "used_engine": used_engine,
            "saved_files": saved_files,
            "message": f"¡Se generó exitosamente {len(saved_files)} imagen(es) usando el motor gratuito **{used_engine}**! Guardadas en la carpeta `generated_images/`."
        }
        
        print(json.dumps(output, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False))

if __name__ == "__main__":
    main()
