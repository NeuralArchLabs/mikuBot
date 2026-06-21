import re
import random
from typing import Optional

def extr(text: str, start: str, end: str) -> Optional[str]:
    """Extrae texto entre dos delimitadores (SearXNG style)"""
    try:
        s = text.find(start)
        if s == -1: return None
        s += len(start)
        e = text.find(end, s)
        if e == -1: return None
        return text[s:e]
    except:
        return None

def gen_useragent() -> str:
    """Genera un User-Agent de escritorio moderno aleatorio"""
    agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ]
    return random.choice(agents)

def gen_mobile_useragent() -> str:
    """Genera un User-Agent móvil moderno aleatorio"""
    agents = [
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.0.0 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
    ]
    return random.choice(agents)

def eval_xpath(tree, path: str):
    """Fallback para selectolax si se portan fragmentos de lxml"""
    # En selectolax usamos css, pero si necesitamos algo específico...
    return tree.css(path)

async def fetch_vqd(query: str, client) -> Optional[str]:
    """Obtiene el token VQD de DuckDuckGo para motores de medios/noticias"""
    try:
        resp = await client.get(f"https://duckduckgo.com/?q={query}", follow_redirects=True)
        vqd = extr(resp.text, 'vqd="', '"') or extr(resp.text, "vqd='", "'")
        return vqd
    except Exception:
        return None

def detect_block(html: str, status_code: int, url: str) -> tuple[bool, str]:
    """
    Detecta bloqueos de WAF, Cloudflare y anti-bot genéricos.
    Retorna (is_blocked: bool, reason: str).
    """
    if not html:
        return False, ""

    html_lower = html.lower()

    # Cloudflare challenge
    if (
        "checking your browser" in html_lower
        or "cf-browser-verification" in html_lower
        or "__cf_chl_" in html
        or '<div id="cf-wrapper"' in html
        or ("just a moment..." in html_lower and "cloudflare" in html_lower)
        or ("attention required!" in html_lower and "cloudflare" in html_lower)
    ):
        return True, "cloudflare"

    # Google challenge/captcha pages
    if (
        "httpservice/retry/enablejs" in html_lower
        or "/sorry/index?continue=" in html_lower
        or "consent.google.com" in url.lower()
    ):
        return True, "google_block"

    # DuckDuckGo block/captcha pages
    if (
        "anomaly-modal" in html_lower
        or "ddg-laptcha" in html_lower
        or "error-lite@duckduckgo.com" in html_lower
    ):
        return True, "ddg_block"

    # Generic WAF / bot detection
    if (
        "access denied" in html_lower
        or "403 forbidden" in html_lower
        or "bot detection" in html_lower
        or "human verification" in html_lower
        or "ddos protection" in html_lower
        or "enable javascript and cookies" in html_lower
    ):
        return True, "waf"

    # HTTP status blocks
    if status_code in (403, 429, 503):
        return True, f"http_{status_code}"

    return False, ""

# Mapeo de idiomas para motores específicos
LANGUAGE_MAP = {
    "google": {
        "es": "es", "en": "en", "it": "it", "fr": "fr", "de": "de", "zh": "zh-CN", "pt": "pt", "ja": "ja"
    },
    "bing": {
        "es": "es-ES", "en": "en-US", "it": "it-IT", "fr": "fr-FR", "de": "de-DE", "zh": "zh-CN", "pt": "pt-PT", "ja": "ja-JP"
    },
    "duckduckgo": {
        "es": "es-es", "en": "us-en", "it": "it-it", "fr": "fr-fr", "de": "de-de", "zh": "cn-zh", "pt": "pt-pt", "ja": "jp-jp"
    },
    "startpage": {
        "es": "espanol", "en": "english", "it": "italiano", "fr": "francais", "de": "deutsch", "zh": "chinese_s", "pt": "portugues", "ja": "japanese"
    },
    "yahoo": {
        "es": "es-ES", "en": "en-US", "it": "it-IT", "fr": "fr-FR", "de": "de-DE", "zh": "zh-CN", "pt": "pt-PT", "ja": "ja-JP"
    },
    "mojeek": {
        "es": "es", "en": "en", "it": "it", "fr": "fr", "de": "de", "zh": "zh", "pt": "pt", "ja": "ja"
    }
}

async def fetch_fallback_search(query: str, lang: str, client) -> list[dict]:
    """
    Realiza una búsqueda de fallback en Brave Search o DuckDuckGo HTML.
    Retorna una lista de diccionarios con {'title', 'url', 'content'}.
    """
    from selectolax.parser import HTMLParser
    from urllib.parse import quote, unquote, urlencode
    
    results = []
    
    # 1. Intentar con Brave Search (GET, muy estable)
    try:
        url = f"https://search.brave.com/search?q={quote(query)}&source=web&hl={lang}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": f"{lang},en;q=0.8"
        }
        resp = await client.get(url, headers=headers, timeout=5.0)
        is_blocked, _ = detect_block(resp.text, resp.status_code, str(resp.url))
        if resp.status_code == 200 and not is_blocked:
            tree = HTMLParser(resp.text)
            for node in tree.css('div.snippet'):
                title_link = node.css_first('a.l1')
                title_node = node.css_first('div.title.search-snippet-title')
                snippet_node = node.css_first('div.content.desktop-default-regular.t-primary') or \
                               node.css_first('.snippet-description') or \
                               node.css_first('.description')
                
                if title_link and title_node:
                    u = title_link.attributes.get('href', '')
                    if u and "brave.com" not in u and u.startswith('http'):
                        results.append({
                            "title": title_node.text().strip(),
                            "url": u,
                            "content": snippet_node.text().strip() if snippet_node else "",
                        })
            
            if not results:
                for node in tree.css('div.snippet, .snippet'):
                    title_link = node.css_first('a[href^="http"]')
                    title_text = node.css_first('.title, h2, h3')
                    snippet_node = node.css_first('.description, .content, p')
                    
                    if title_link:
                        u = title_link.attributes.get('href', '')
                        if u and "brave.com" not in u and u.startswith('http'):
                            results.append({
                                "title": title_text.text().strip() if title_text else title_link.text().strip(),
                                "url": u,
                                "content": snippet_node.text().strip() if snippet_node else "",
                            })
    except Exception as e:
        print(f"Brave fallback failed: {e}")

    # 2. Si Brave no devolvió nada, intentar con DuckDuckGo HTML
    if not results:
        try:
            kl = LANGUAGE_MAP.get("duckduckgo", {}).get(lang, "wt-wt")
            query_params = {
                "q": query,
                "kl": kl,
                "df": ""
            }
            url = f"https://html.duckduckgo.com/html/?{urlencode(query_params)}"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Referer": "https://html.duckduckgo.com/",
                "Accept-Language": f"{lang},en;q=0.8"
            }
            resp = await client.get(url, headers=headers, timeout=5.0)
            is_blocked, _ = detect_block(resp.text, resp.status_code, str(resp.url))
            if resp.status_code == 200 and not is_blocked:
                tree = HTMLParser(resp.text)
                for node in tree.css('div.result'):
                    title_node = node.css_first('a.result__a') or node.css_first('.result__title a')
                    snippet_node = node.css_first('.result__snippet')
                    
                    if title_node:
                        title = title_node.text().strip()
                        u = title_node.attributes.get('href', '')
                        
                        if 'uddg=' in u:
                            try:
                                u = unquote(u.split('uddg=')[1].split('&')[0])
                            except:
                                pass
                        
                        if u.startswith('http') and not "duckduckgo.com" in u:
                            content = snippet_node.text().strip() if snippet_node else ""
                            results.append({
                                "title": title,
                                "url": u,
                                "content": content
                            })
        except Exception as e:
            print(f"DDG HTML fallback failed: {e}")
            
    return results
