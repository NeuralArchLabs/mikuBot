import json

CATEGORIES = ["news"]
WEIGHT = 1.5

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
    offset = (params.get("pageno", 1) - 1) * 20
    lang = params.get("language", "es")
    params["url"] = f"https://search.brave.com/news/__data.json?q={query}&offset={offset}&hl={lang}"
    params["headers"]["Accept"] = "*/*"
    params["headers"]["Accept-Encoding"] = "gzip, deflate"

def response(resp):
    results = []
    try:
        data = resp.json()
        node_data = data["nodes"][1]["data"]
        resolved_root = resolve(0, node_data)
        
        resp_obj = resolved_root.get("response", {}) if isinstance(resolved_root, dict) else {}
        if isinstance(resp_obj, dict):
            news_obj = resp_obj.get("news", {})
            if isinstance(news_obj, dict):
                items = news_obj.get("results", [])
                for item in items:
                    title = item.get("title", "")
                    url = item.get("url", "")
                    description = item.get("description", "")
                    age = item.get("age", "")
                    
                    profile = item.get("profile", {})
                    source_name = profile.get("name", "Noticia") if isinstance(profile, dict) else "Noticia"
                    
                    if url and "brave.com" not in url and url.startswith("http"):
                        content_prefix = f"{source_name} ({age}): " if age else f"{source_name}: "
                        results.append({
                            "title": title,
                            "url": url,
                            "content": content_prefix + description,
                            "source": "brave_news"
                        })
    except Exception as e:
        print(f"Error parsing Brave News: {e}")
    return results
