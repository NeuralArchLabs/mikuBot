STATUS = "experimental"
from selectolax.parser import HTMLParser
from urllib.parse import urlencode, urlparse, parse_qs, unquote
from utils import LANGUAGE_MAP
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
    params["cookies"]["MUID"] = ""
    params["cookies"]["SRCHD"] = "AF=NOFORM"
    params["cookies"]["SRCHUSR"] = "DOB=20200101"
    
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
    params["headers"]["Accept-Language"] = f"{lang_code},{lang};q=0.9,en;q=0.8"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    # Updated selectors: more generic
    for node in tree.css('li.b_algo, .b_algo, div#b_results li, article'):
        title_tag = node.css_first('h2 a, h3 a, .title a, a')
        snippet_tag = node.css_first('div.b_caption p, .b_caption p, div.b_snippet, p')
        
        img_node = node.css_first('img')
        price_node = node.css_first('.b_price, .promoted-price')
        
        if title_tag:
            url = title_tag.attributes.get('href', '')
            
            # Bing sometimes wraps URLs in /ck/a? redirects with base64
            if url.startswith('https://www.bing.com/ck/a?'):
                url = _decode_bing_url(url)
            
            if url and url.startswith('http') and 'bing.com' not in url:
                item = {
                    "title": title_tag.text().strip(),
                    "url": url,
                    "content": snippet_tag.text().strip() if snippet_tag else "Resultado de Bing.",
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
