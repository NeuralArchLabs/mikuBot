import json

CATEGORIES = ["images"]
WEIGHT = 1.0

def resolve(val, data_list, memo=None):
    if memo is None:
        memo = {}
        
    if isinstance(val, int):
        if val in memo:
            return memo[val]
        if 0 <= val < len(data_list):
            memo[val] = "CIRCULAR"
            res = resolve(data_list[val], data_list, memo)
            memo[val] = res
            return res
        return val
    elif isinstance(val, dict):
        return {k: resolve(v, data_list, memo) for k, v in val.items()}
    elif isinstance(val, list):
        return [resolve(x, data_list, memo) for x in val]
    else:
        return val

def request(query, params):
    params["url"] = f"https://search.brave.com/images/__data.json?q={query}"
    params["headers"]["Accept"] = "*/*"
    params["headers"]["Accept-Encoding"] = "gzip, deflate"

def response(resp):
    results = []
    try:
        data = resp.json()
        node_data = data["nodes"][1]["data"]
        resolved_root = resolve(0, node_data)
        
        resp_obj = None
        if isinstance(resolved_root, dict):
            if "body" in resolved_root and isinstance(resolved_root["body"], dict):
                resp_obj = resolved_root["body"].get("response", {})
            elif "response" in resolved_root:
                resp_obj = resolved_root["response"]
                
        if resp_obj and isinstance(resp_obj, dict):
            items = resp_obj.get("results", [])
            for item in items:
                title = item.get("title", "Brave Image")
                url = item.get("url", "")
                
                props = item.get("properties", {})
                img_src = props.get("url") if isinstance(props, dict) else None
                if not img_src:
                    img_src = item.get("img_src")
                    
                thumbnail_obj = item.get("thumbnail", {})
                thumbnail_src = None
                if isinstance(thumbnail_obj, dict):
                    thumbnail_src = thumbnail_obj.get("src") or thumbnail_obj.get("url")

                if url and img_src and img_src.startswith("http"):
                    results.append({
                        "template": "images.html",
                        "title": title,
                        "url": url,
                        "img_src": img_src,
                        "thumbnail_src": thumbnail_src or img_src,
                        "source": "brave"
                    })
    except Exception as e:
        print(f"Error parsing Brave Images: {e}")
    return results
