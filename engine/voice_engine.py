import sys
import json
import os
import signal

# Import vosk safely
try:
    from vosk import Model, KaldiRecognizer
except ImportError:
    print(json.dumps({"error": "Vosk Python package not installed. Run 'pip install vosk'"}), flush=True)
    sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No model path provided"}), flush=True)
        return

    model_path = sys.argv[1]
    if not os.path.exists(model_path):
        print(json.dumps({"error": f"Model path not found: {model_path}"}), flush=True)
        return

    try:
        # Avoid the annoying log messages from Kaldi
        import logging
        from vosk import SetLogLevel
        SetLogLevel(-1)

        model = Model(model_path)
        # Standard format for node-record-lpcm16: 16000Hz, 16-bit, mono
        rec = KaldiRecognizer(model, 16000)
        
        # Signal to Node.js that we are ready to receive data
        print(json.dumps({"status": "ready"}), flush=True)

        while True:
            # Read raw bytes from stdin (node.js pipe)
            data = sys.stdin.buffer.read(4000)
            if not data:
                break
            
            if rec.AcceptWaveform(data):
                res = json.loads(rec.Result())
                if res.get("text"):
                    print(json.dumps({"text": res["text"], "final": True}), flush=True)
            else:
                partial = json.loads(rec.PartialResult())
                if partial.get("partial"):
                    print(json.dumps({"text": partial["partial"], "final": False}), flush=True)

        # Print final result when stdin closes
        final = json.loads(rec.FinalResult())
        if final.get("text"):
            print(json.dumps({"text": final["text"], "final": True}), flush=True)

    except Exception as e:
        print(json.dumps({"error": str(e)}), flush=True)

if __name__ == "__main__":
    # Handle graceful exit
    signal.signal(signal.SIGINT, lambda s, f: sys.exit(0))
    main()
