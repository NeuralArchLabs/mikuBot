from selectolax.parser import HTMLParser
from urllib.parse import urlencode, unquote
from utils import LANGUAGE_MAP

CATEGORIES = ["news"]

def request(query, params):
    # Google News modo móvil (siempre devuelve HTML simple y rico)
    lang = params.get("language", "es")
    lang_code = LANGUAGE_MAP.get("google", {}).get(lang, "es")
    country = lang_code.upper() if len(lang_code) == 2 else "US"
    
    query_params = {
        "q": query,
        "tbm": "nws",
        "hl": lang_code,
        "gl": country,
        "start": (params.get("pageno", 1) - 1) * 10
    }
    params["url"] = f"https://www.google.com/search?{urlencode(query_params)}"
    params["headers"]["User-Agent"] = "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
    
    import random
    cb_val = random.randint(20230000, 20249999)
    params["cookies"]["CONSENT"] = f"YES+cb.{cb_val}-04-p0.{lang}+FX+414"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    # En móvil, las noticias suelen ir en selectores 'div[role="heading"]' o dentro de bloques 'a'
    for node in tree.css('a[href*="url?q="], div.Gx5S9b'):
        title_node = node.css_first('div[role="heading"], div.BNeawe.vv14be')
        snippet_node = node.css_first('div.S5uMzb, div.BNeawe.s31JSe, div.BNeawe.tAd7D, div.fBMe9b')
        
        if title_node:
            title_text = title_node.text().strip()
            # Si el titulo parece una URL fragmentada, lo saltamos
            if len(title_text) < 10 and "/" in title_text: continue
            
            url = node.attributes.get('href', '')
            if '/url?q=' in url:
                url = unquote(url.split('/url?q=')[1].split('&sa=')[0])
                
            if url.startswith('http') and "google.com" not in url:
                results.append({
                    "title": title_text,
                    "url": url,
                    "content": snippet_node.text().strip() if snippet_node else "Noticia de Google News.",
                    "source": "google_news"
                })
                
    return results
