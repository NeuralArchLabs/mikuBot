import random
from selectolax.parser import HTMLParser
from urllib.parse import urlencode, unquote
import re
import httpx
import asyncio
from utils import fetch_fallback_search, detect_block

NAME = "mercadolibre"
CATEGORIES = ["shopping"]
WEIGHT = 1.0

ML_DOMAINS = {
    "mx": "articulo.mercadolibre.com.mx",
    "br": "produto.mercadolivre.com.br",
    "ar": "articulo.mercadolibre.com.ar",
    "cl": "articulo.mercadolibre.cl",
    "co": "articulo.mercadolibre.com.co",
    "es": "articulo.mercadolibre.com.mx",  # Fallback to MX
    "pt": "produto.mercadolivre.com.br"   # Brazil
}

_GSA_UAS = [
    "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.105 Mobile Safari/537.36 NSTNWV",
    "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Mobile Safari/537.36 NSTNWV",
    "Mozilla/5.0 (Linux; Android 7.0; SM-G892A Build/NRD90M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Mobile Safari/537.36 NSTNWV",
    "Mozilla/5.0 (Linux; Android 8.0; Pixel 2 Build/OPD3.170816.012) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Mobile Safari/537.36 NSTNWV",
    "Mozilla/5.0 (Linux; Android 9; SM-G960F Build/PPR1.180610.011) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36 NSTNWV",
]

def find_best_image(product_title, images, used_indices):
    product_words = set(re.findall(r'\w+', product_title.lower()))
    product_words = product_words - {"para", "con", "de", "el", "la", "los", "las", "en", "un", "una", "y", "a", "por"}
    
    best_score = -1
    best_idx = -1
    
    for idx, img in enumerate(images):
        if idx in used_indices:
            continue
        img_title_words = set(re.findall(r'\w+', img.get("title", "").lower()))
        score = len(product_words.intersection(img_title_words))
        if score > best_score:
            best_score = score
            best_idx = idx
            
    if best_idx != -1 and best_score > 0:
        used_indices.add(best_idx)
        return images[best_idx].get("thumbnail_src") or images[best_idx].get("img_src")
        
    for idx, img in enumerate(images):
        if idx not in used_indices:
            used_indices.add(idx)
            return img.get("thumbnail_src") or img.get("img_src")
            
    if images:
        return images[0].get("thumbnail_src") or images[0].get("img_src")
    return None

def request(query, params):
    lang = params.get("language", "es")
    region = params.get("region", "mx").lower()
    domain = ML_DOMAINS.get(region, ML_DOMAINS.get(lang, "articulo.mercadolibre.com.mx"))
    offset = (params.get("pageno", 1) - 1) * 10
    
    price_term = "precio" if lang in ("es", "pt") else "price"
    
    query_params = {
        "q": f"site:{domain} {query} {price_term}",
        "hl": lang,
        "num": 10,
        "start": offset,
        "pws": "0"
    }
    params["url"] = f"https://www.google.com/search?{urlencode(query_params)}"
    params["headers"]["User-Agent"] = random.choice(_GSA_UAS)
    params["headers"]["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
    params["headers"]["Accept-Language"] = f"{lang},{lang};q=0.9,en;q=0.7"
    params["headers"]["Referer"] = "https://www.google.com/"
    
    cb_val = random.randint(20230000, 20249999)
    params["cookies"]["CONSENT"] = f"YES+cb.{cb_val}-04-p0.{lang}+FX+414"
    params["cookies"]["SOCS"] = "CAESHAgBEhJmb3NfbGVzcy9zZWFyY2gvaG9tZQ"

async def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    # GSA mobile version has xpd, Gx5Zad, MjjYud, g, kCrYT containers
    nodes = tree.css("div.Gx5Zad, div.xpd, div.MjjYud, div.g, div.kCrYT")
    
    price_regex = r'([\$€£¥₹\u20aa\u20a9\u20b9\u20ba\u20bd\ua7f6]R?\$?\s?\d+(?:[\.,]\d+)*|\d+(?:[\.,]\d+)*\s?(?:[\$€£¥₹\u20aa\u20a9\u20b9\u20ba\u20bd\ua7f6]|EUR|USD|MXN|GBP|CAD|AUD|ARS|CLP|COP|BRL|pesos|EUR\b|USD\b|MXN\b|GBP\b|BRL\b))'
    
    for node in nodes:
        title_node = node.css_first("h3, .vv14be, .DKV0Md")
        url_node = node.css_first("a[href]")
        snippet_node = node.css_first("div.H66NU, div.VwiC3b, div.BNeawe.s3v9rd")
        
        if title_node and url_node:
            url = url_node.attributes.get("href", "")
            if "/url?q=" in url:
                try:
                    url = unquote(url.split("?q=")[1].split("&")[0])
                except:
                    pass
            
            if url and url.startswith("http") and ("mercadolibre." in url or "mercadolivre." in url) and ("/MLM-" in url or "/MLB-" in url or "/MLA-" in url or "/MLC-" in url or "/p/" in url):
                title = title_node.text().strip()
                content = snippet_node.text().strip() if snippet_node else "Ver producto en MercadoLibre."
                
                # Clean MercadoLibre titles
                for clean_suff in [" | MercadoLibre", " - MercadoLibre", " | MercadoLivre", " - MercadoLivre", " en Mercado Libre Mxico", " en Mercado Libre México"]:
                    if title.endswith(clean_suff):
                        title = title[:-len(clean_suff)]
                
                # Extract price if present
                price = None
                price_match = re.search(price_regex, content + " " + title)
                if price_match:
                    price = price_match.group(1).strip()
                
                res = {
                    "title": title,
                    "url": url,
                    "content": content,
                    "source": "mercadolibre",
                    "template": "shopping.html"
                }
                if price:
                    res["price"] = price
                results.append(res)
                
    # Parse query from resp.url
    clean_query = ""
    try:
        from urllib.parse import urlparse, parse_qs
        parsed_url = urlparse(str(resp.url))
        qs = parse_qs(parsed_url.query)
        q_val = qs.get("q", [""])[0]
        clean_query = q_val
        clean_query = re.sub(r'site:[^\s]+', '', clean_query)
        clean_query = re.sub(r'\b(precio|price)\b', '', clean_query, flags=re.IGNORECASE)
        clean_query = re.sub(r'\s+', ' ', clean_query).strip()
    except Exception:
        pass

    if not clean_query:
        clean_query = results[0]["title"] if results else "producto"

    # Fallback to general search fallback if blocked or 0 results
    is_blocked, _ = detect_block(resp.text, resp.status_code, resp.url)
    if not results or is_blocked:
        try:
            from urllib.parse import urlparse, parse_qs
            parsed_url = urlparse(str(resp.url))
            qs = parse_qs(parsed_url.query)
            original_q = qs.get("q", [""])[0]
            if not original_q:
                original_q = f"site:articulo.mercadolibre.com.mx {clean_query} precio"
            
            lang = resp.search_params.get("language", "es")
            fallback_results = await fetch_fallback_search(original_q, lang, resp.client)
            for r in fallback_results:
                url_lite = r["url"]
                if url_lite and url_lite.startswith("http") and ("mercadolibre." in url_lite or "mercadolivre." in url_lite) and ("/MLM-" in url_lite or "/MLB-" in url_lite or "/MLA-" in url_lite or "/MLC-" in url_lite or "/p/" in url_lite):
                    # Clean MercadoLibre titles
                    title_lite = r["title"]
                    for clean_suff in [" | MercadoLibre", " - MercadoLibre", " | MercadoLivre", " - MercadoLivre", " en Mercado Libre Mxico", " en Mercado Libre México"]:
                        if title_lite.endswith(clean_suff):
                            title_lite = title_lite[:-len(clean_suff)]
                            
                    price_lite = None
                    price_match = re.search(price_regex, r["content"] + " " + title_lite)
                    if price_match:
                        price_lite = price_match.group(1).strip()
                        
                    res = {
                        "title": title_lite,
                        "url": url_lite,
                        "content": r["content"] or "Ver producto en MercadoLibre.",
                        "source": "mercadolibre",
                        "template": "shopping.html"
                    }
                    if price_lite:
                        res["price"] = price_lite
                    results.append(res)
        except Exception as e:
            print(f"EXCEPTION in mercadolibre fallback: {e}")

    # Enrich results with actual O-zen extraction in parallel
    if results:
        try:
            from ozen_engine.site_extractors import extract_site_specific
            
            async def enrich_result(r):
                try:
                    product_data = await asyncio.wait_for(
                        extract_site_specific(r["url"], resp.client),
                        timeout=1.8
                    )
                    if product_data and "metadata" in product_data:
                        meta = product_data["metadata"]
                        if meta.get("image"):
                            r["img_src"] = meta["image"]
                            r["thumbnail_src"] = meta["image"]
                        if meta.get("price") and meta["price"] != "No disponible":
                            r["price"] = meta["price"]
                        if meta.get("rating"):
                            r["rating"] = meta["rating"]
                        if meta.get("reviews"):
                            r["reviews"] = meta["reviews"]
                        if meta.get("description"):
                            r["content"] = meta["description"]
                except Exception:
                    pass
            
            await asyncio.gather(*(enrich_result(r) for r in results[:5]))
        except Exception as e:
            print(f"Exception enriching ML results: {e}")

    # Fetch DDG Images batch as backup for results that still don't have an img_src
    results_needing_image = [r for r in results if not r.get("img_src")]
    if results_needing_image:
        images = []
        try:
            from engines import duckduckgo_images
            async with httpx.AsyncClient(verify=False, timeout=6.0) as client:
                params_imgs = {
                    "language": "es",
                    "pageno": 1,
                    "headers": {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                        "Accept-Language": "es-ES,es;q=0.9"
                    },
                    "cookies": {},
                    "client": client
                }
                await duckduckgo_images.request(clean_query, params_imgs)
                async with httpx.AsyncClient(http2=True, verify=False, timeout=6.0) as client_h2:
                    resp_imgs = await client_h2.get(
                        params_imgs["url"],
                        headers=params_imgs["headers"],
                        cookies=params_imgs["cookies"]
                    )
                    images = duckduckgo_images.response(resp_imgs) or []
        except Exception:
            pass

        used_indices = set()
        for r in results:
            if not r.get("img_src"):
                matched_img = find_best_image(r["title"], images, used_indices)
                if matched_img:
                    r["img_src"] = matched_img
                    r["thumbnail_src"] = matched_img
                    
    return results

