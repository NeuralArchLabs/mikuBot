import sys
import json
from datetime import datetime

def main():
    try:
        # Args passed as JSON string in first argument
        args = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
        fmt = args.get('format', '24h')
        
        now = datetime.now()
        if fmt == '12h':
            time_str = now.strftime("%I:%M %p")
        else:
            time_str = now.strftime("%H:%M")
            
        result = {
            "time": time_str,
            "message": f"¡Hola Armando! Son las {time_str}. ¡Miku está lista para ayudarte! 🕐✨"
        }
        # Clear print of JSON
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
