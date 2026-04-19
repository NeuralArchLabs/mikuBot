import os

def rename_backgrounds():
    bg_dir = "backgrounds"
    if not os.path.exists(bg_dir):
        print(f"Directory {bg_dir} not found.")
        return

    files = [f for f in os.listdir(bg_dir) if os.path.isfile(os.path.join(bg_dir, f))]
    # Filter for image extensions
    image_extensions = ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp')
    images = [f for f in files if f.lower().endswith(image_extensions)]
    
    images.sort() # Sort to have consistent renaming

    for i, filename in enumerate(images, 1):
        ext = os.path.splitext(filename)[1].lower()
        new_name = f"miku_bg_{i}{ext}"
        old_path = os.path.join(bg_dir, filename)
        new_path = os.path.join(bg_dir, new_name)
        
        # If the file is already renamed (e.g. running twice), skip if possible or handle conflict
        if filename == new_name:
            continue
            
        print(f"Renaming: {filename} -> {new_name}")
        try:
            os.rename(old_path, new_path)
        except Exception as e:
            print(f"Error renaming {filename}: {e}")

if __name__ == "__main__":
    rename_backgrounds()
