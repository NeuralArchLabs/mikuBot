STATUS = "experimental"
from selectolax.parser import HTMLParser
from urllib.parse import urlencode, urlparse, parse_qs, unquote
from utils import LANGUAGE_MAP, gen_mobile_useragent
import base64

CATEGORIES = ["general"]
WEIGHT = 3.0

def request(query, params):
    lang = params.get("language", "es")
    lang_code = LANGUAGE_MAP.get("bing", {}).get(lang, "en-US")
    country = lang_code.split('-')[1].lower() if '-' in lang_code else "us"
    
    # Cookies to force market and avoid redirects
    params["cookies"]["_EDGE_CD"] = f"m={lang_code}&u={lang_code}"
    params["cookies"]["_EDGE_S"] = f"mkt={lang_code}&ui={lang_code}"
    
    query_params = {
        "q": query,
        "pq": query,
        "FORM": "QBRE",
        "cc": country,
        "setlang": lang_code,
    }
    
    if params.get("pageno", 1) > 1:
        query_params["first"] = (params["pageno"] - 1) * 10 + 1
        query_params["FORM"] = f"PERE{(params['pageno']-2) if params['pageno'] > 2 else ''}"

    params["url"] = f"https://www.bing.com/search?{urlencode(query_params)}"
    params["headers"]["User-Agent"] = gen_mobile_useragent()
    params["headers"]["Accept-Language"] = f"{lang_code},{lang};q=0.9,en;q=0.8"
    params["headers"]["Accept-Encoding"] = "gzip, deflate"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    # Updated selectors: more generic
    for node in tree.css('li.b_algo, .b_algo, div#b_results li, article'):
        header = node.css_first('h2, h3')
        
        url = ""
        title = ""
        
        title_link = header.css_first('a') if header else None
        if title_link:
            url = title_link.attributes.get('href', '')
            title = title_link.text().strip()
        else:
            title = header.text().strip() if header else ""
            for a in node.css('a'):
                href = a.attributes.get('href', '')
                if href and href.startswith('http') and 'bing.com' not in href:
                    url = href
                    break
                    
        if not url:
            # Fallback to any external/internal link
            for a in node.css('a'):
                href = a.attributes.get('href', '')
                if href and href.startswith('http'):
                    url = href
                    break
                    
        if not url or 'bing.com' in url:
            continue
            
        if url.startswith('https://www.bing.com/ck/a?'):
            url = _decode_bing_url(url)
            
        snippet_tag = node.css_first('div.b_caption p, .b_caption p, div.b_snippet, p')
        content = snippet_tag.text().strip() if snippet_tag else "Resultado de Bing."
        
        img_node = node.css_first('img')
        price_node = node.css_first('.b_price, .promoted-price')
        
        item = {
            "title": title or "Resultado de Bing",
            "url": url,
            "content": content,
            "source": "bing"
        }
        
        if img_node:
            src = img_node.attributes.get('src') or img_node.attributes.get('data-src')
            if src and src.startswith('http'):
                item["thumbnail_src"] = src
        if price_node:
            item["price"] = price_node.text().strip()
            
        results.append(item)
    return results

def _decode_bing_url(url):
    """Decode Bing's base64 wrapped redirect URLs."""
    try:
        url_query = urlparse(url).query
        parsed = parse_qs(url_query)
        if 'u' in parsed:
            v = parsed['u'][0]
            if v.startswith('a1'):
                v = v[2:]  # Remove 'a1' prefix
            v = v + "=" * (-len(v) % 4)  # Add padding
            decoded = base64.urlsafe_b64decode(v).decode('utf-8')
            return decoded
    except:
        pass
    return url
