import sys
import os

# Add local site-packages to sys.path to allow imports from any environment
base_dir = os.path.dirname(os.path.abspath(__file__))
local_site_packages = os.path.join(base_dir, "Lib", "site-packages")
if os.path.exists(local_site_packages) and local_site_packages not in sys.path:
    sys.path.insert(0, local_site_packages)

import json
import urllib.request
import numpy as np
import wave

# Force UTF-8 encoding for stdin and stdout (vital on Windows to prevent Unicode corruption of accented characters)
if hasattr(sys.stdin, 'reconfigure'):
    sys.stdin.reconfigure(encoding='utf-8')
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Map languages to standard Kokoro voice names
LANG_VOICE_MAP = {
    "es": "ef_dora",
    "en": "af_heart",
    "zh": "zf_xiaoxiao"
}

# The renderer keeps four synthesis slots occupied.  ONNX must therefore use
# only its share of the available logical CPUs per slot; giving every request
# four intra-op threads caused four concurrent jobs to contend for up to
# sixteen threads, especially hurting the first audible clip on small CPUs.
SYNTHESIS_WORKER_COUNT = 4

# Default URLs
MODEL_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx"
VOICES_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"

def download_file(url, dest_path, file_label):
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    temp_dest = dest_path + ".tmp"
    
    print(json.dumps({"status": "downloading", "file": file_label, "progress": 0.0}), flush=True)
    
    try:
        def reporthook(block_num, block_size, total_size):
            if total_size > 0:
                downloaded = block_num * block_size
                progress = min(downloaded / total_size, 1.0)
                # Round to two decimal places
                progress = round(progress, 2)
                print(json.dumps({"status": "downloading", "file": file_label, "progress": progress}), flush=True)

        urllib.request.urlretrieve(url, temp_dest, reporthook)
        
        if os.path.exists(dest_path):
            os.remove(dest_path)
        os.rename(temp_dest, dest_path)
        print(json.dumps({"status": "downloaded", "file": file_label}), flush=True)
    except Exception as e:
        if os.path.exists(temp_dest):
            try:
                os.remove(temp_dest)
            except:
                pass
        raise e

def write_wav(path, samples, sample_rate):
    # Convert float32 samples to 16-bit PCM WAV
    samples = np.clip(samples, -1.0, 1.0)
    int_samples = (samples * 32767.0).astype(np.int16)
    
    with wave.open(path, 'wb') as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(int_samples.tobytes())

def main():
    # Setup directories
    base_dir = os.path.dirname(os.path.abspath(__file__))
    models_dir = os.path.join(base_dir, "models", "kokoro")
    
    model_path = os.path.join(models_dir, "kokoro-v1.0.int8.onnx")
    voices_path = os.path.join(models_dir, "voices-v1.0.bin")
    
    # Check if files exist, download if not
    try:
        if not os.path.exists(model_path):
            download_file(MODEL_URL, model_path, "model")
        if not os.path.exists(voices_path):
            download_file(VOICES_URL, voices_path, "voices")
    except Exception as e:
        print(json.dumps({"status": "error", "error": f"Failed to download Kokoro files: {str(e)}"}), flush=True)
        return

    # Import kokoro after ensuring files are here
    try:
        from kokoro_onnx import Kokoro
    except ImportError as e:
        print(json.dumps({"status": "error", "error": f"Failed to import kokoro_onnx: {str(e)}"}), flush=True)
        return

    # Initialize Kokoro with optimized SessionOptions
    try:
        import onnxruntime as rt
        sess_options = rt.SessionOptions()
        sess_options.graph_optimization_level = rt.GraphOptimizationLevel.ORT_ENABLE_ALL
        
        # Keep the four synthesis workers responsive on any CPU.  The budget
        # is distributed across workers instead of assigning a fixed four
        # threads to each simultaneous ONNX call (4 workers × 4 threads).
        logical_cpu_count = os.cpu_count() or SYNTHESIS_WORKER_COUNT
        cpu_threads_per_worker = max(1, logical_cpu_count // SYNTHESIS_WORKER_COUNT)
        sess_options.intra_op_num_threads = cpu_threads_per_worker
        sess_options.inter_op_num_threads = 1
        
        # The GPU package exposes the same ``onnxruntime`` module as the CPU
        # package, so probing for a module named ``onnxruntime-gpu`` can never
        # reliably detect CUDA. Ask ONNX Runtime itself and always retain CPU
        # as the ordered fallback for machines without a compatible GPU.
        available_providers = rt.get_available_providers()
        providers = ["CPUExecutionProvider"]
        if "CUDAExecutionProvider" in available_providers:
            providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]

        cuda_fallback = False
        try:
            session = rt.InferenceSession(model_path, sess_options, providers=providers)
        except Exception:
            if providers[0] != "CUDAExecutionProvider":
                raise
            # A CUDA provider can be registered even when its driver/runtime
            # cannot initialize on this machine. Recreate the session on CPU
            # instead of preventing TTS from starting at all.
            cuda_fallback = True
            session = rt.InferenceSession(
                model_path,
                sess_options,
                providers=["CPUExecutionProvider"]
            )
        kokoro = Kokoro.from_session(session, voices_path)
        
        # Warmup: run a fast compilation/synthesis run so the first user interaction is instant
        kokoro.create(".", voice="ef_dora", speed=1.0, lang="es")
        
        print(json.dumps({
            "status": "ready",
            "providers": session.get_providers(),
            "cuda_fallback": cuda_fallback,
            "cpu_threads_per_worker": cpu_threads_per_worker
        }), flush=True)
    except Exception as e:
        print(json.dumps({"status": "error", "error": f"Failed to initialize Kokoro: {str(e)}"}), flush=True)
        return

    import threading
    from concurrent.futures import ThreadPoolExecutor

    # Exactly four concurrent synthesis jobs are kept available to match the
    # renderer pipeline.  Their ONNX thread budget was set above.
    executor = ThreadPoolExecutor(max_workers=SYNTHESIS_WORKER_COUNT)
    print_lock = threading.Lock()
    tokenizer_lock = threading.Lock()

    def safe_print(msg_dict):
        with print_lock:
            print(json.dumps(msg_dict), flush=True)

    def process_request(req):
        output_path = req.get("output_path")
        try:
            text = req.get("text", "").strip()
            lang = req.get("lang", "es")
            voice = req.get("voice")
            speed = float(req.get("speed", 1.0))
            
            if not text:
                safe_print({"status": "error", "error": "No text provided to synthesize", "output_path": output_path})
                return
                
            if not output_path:
                safe_print({"status": "error", "error": "No output path provided"})
                return

            # Map language to voice if not specified
            if not voice:
                lang_prefix = lang.split('-')[0].lower()
                voice = LANG_VOICE_MAP.get(lang_prefix, "af_heart")

            # Map language to the proper kokoro language code
            lang_prefix = lang.split('-')[0].lower()
            if lang_prefix == "es":
                lang_code = "es"
            elif lang_prefix == "zh":
                lang_code = "zh"
            else:
                lang_code = "en-us"

            # Determine trailing silence based on punctuation
            delay_seconds = 0.0
            if text:
                import re
                if re.search(r'[.!?:]["\')\]]*$', text):
                    delay_seconds = 0.65
                elif re.search(r'[,;]["\')\]]*$', text):
                    delay_seconds = 0.30

            # Run phonemization inside a lock as espeak-ng is not thread-safe on Windows
            with tokenizer_lock:
                phonemes = kokoro.tokenizer.phonemize(text, lang_code)

            # Synthesize audio from phonemes (re-entrant, thread-safe session execution)
            samples, sample_rate = kokoro.create(
                phonemes,
                voice=voice,
                speed=speed,
                lang=lang_code,
                is_phonemes=True
            )
            
            if delay_seconds > 0.0:
                silent_samples = int(delay_seconds * sample_rate)
                silence = np.zeros(silent_samples, dtype=np.float32)
                samples = np.concatenate([samples, silence])
            
            # Write wav file
            write_wav(output_path, samples, sample_rate)
            
            safe_print({"status": "success", "output_path": output_path})
        except Exception as e:
            err_msg = {"status": "error", "error": f"Synthesis failed: {str(e)}"}
            if output_path:
                err_msg["output_path"] = output_path
            safe_print(err_msg)

    # Read config from stdin continuously
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            
            req = json.loads(line)
            executor.submit(process_request, req)
        except Exception as e:
            safe_print({"status": "error", "error": f"Failed to submit request: {str(e)}"})

if __name__ == "__main__":
    main()
