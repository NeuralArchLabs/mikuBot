import requests
import json
import sys
import os

# --- CONFIGURE SSL (Safe for internal/test proxies) ---
# Supress warnings if verify=False is needed in some enterprise envs
# requests.packages.urllib3.disable_warnings()

def main():
    try:
        # Detect arguments
        if len(sys.argv) < 2:
            print(json.dumps({"error": "Missing arguments JSON string."}))
            return

        # Parse JSON arguments from system argv
        # The main app sends a single JSON string as the first argument
        try:
            args = json.loads(sys.argv[1])
        except Exception as e:
            # Fallback check: sometimes Electron might wrap it differently
            print(json.dumps({"error": f"Failed to parse arguments: {str(e)}", "raw": sys.argv[1]}))
            return

        url = args.get('url')
        method = args.get('method', 'GET').upper()
        headers = args.get('headers', {})
        params = args.get('params', {})
        body = args.get('body', {})
        timeout = args.get('timeout', 15)

        if not url:
            print(json.dumps({"error": "No URL provided."}))
            return

        # Prepare request
        response = None
        if method == 'GET':
            response = requests.get(url, headers=headers, params=params, timeout=timeout)
        elif method == 'POST':
            response = requests.post(url, headers=headers, params=params, json=body, timeout=timeout)
        elif method == 'PUT':
            response = requests.put(url, headers=headers, params=params, json=body, timeout=timeout)
        elif method == 'DELETE':
            response = requests.delete(url, headers=headers, params=params, timeout=timeout)
        else:
            print(json.dumps({"error": f"Unsupported method: {method}"}))
            return

        # Parse output
        status_code = response.status_code
        try:
            data = response.json()
            is_json = True
        except:
            data = response.text
            is_json = False

        # Build final output
        result = {
            "status": status_code,
            "url": response.url,
            "type": "json" if is_json else "text",
            "data": data,
            "ok": response.ok
        }

        # Truncate check for massive outputs (MikuCentral Agent context safety)
        # If response is > 20000 chars and is text, truncate
        json_output = json.dumps(result, ensure_ascii=False)
        if len(json_output) > 20000:
            truncated = json_output[:19900] + "... [RESPONSE TRUNCATED DUE TO SIZE]"
            print(truncated)
        else:
            print(json_output)

    except requests.exceptions.Timeout:
        print(json.dumps({"error": "Request timed out.", "ok": False}))
    except requests.exceptions.RequestException as e:
        print(json.dumps({"error": f"Request failed: {str(e)}", "ok": False}))
    except Exception as e:
        print(json.dumps({"error": f"Unexpected skill error: {str(e)}", "ok": False}))

if __name__ == "__main__":
    main()
