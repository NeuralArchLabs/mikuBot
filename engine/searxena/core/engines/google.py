"""
Google general web search engine.
Uses GSA (Google Search App) User-Agent strings to bypass JS-redirect blocks.
"""
STATUS = "experimental"
import random
import re
from urllib.parse import urlencode, unquote
from utils import LANGUAGE_MAP, fetch_fallback_search, detect_block
from selectolax.parser import HTMLParser

CATEGORIES = ["general"]
WEIGHT = 1.5

# GSA (Google Search App) User-Agents bypass Google's JS-only anti-bot page.
# These contain NSTNWV marker which signals the GSA client.
_GSA_UAS = [
    "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.105 Mobile Safari/537.36 NSTNWV",
    "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Mobile Safari/537.36 NSTNWV",
    "Mozilla/5.0 (Linux; Android 7.0; SM-G892A Build/NRD90M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Mobile Safari/537.36 NSTNWV",
    "Mozilla/5.0 (Linux; Android 8.0; Pixel 2 Build/OPD3.170816.012) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Mobile Safari/537.36 NSTNWV",
    "Mozilla/5.0 (Linux; Android 9; SM-G960F Build/PPR1.180610.011) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36 NSTNWV",
]


def request(query, params):
    offset = (params.get("pageno", 1) - 1) * 10
    lang = params.get("language", "es")
    lang_code = LANGUAGE_MAP.get("google", {}).get(lang, "es")

    query_params = {
        "q": query,
        "hl": lang_code,
        "num": 10,
        "start": offset,
        "pws": "0",  # Disable personalized results
    }

    params["url"] = f"https://www.google.com/search?{urlencode(query_params)}"
    params["headers"]["User-Agent"] = random.choice(_GSA_UAS)
    params["headers"]["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
    params["headers"]["Accept-Language"] = f"{lang_code},{lang};q=0.9,en;q=0.7"
    params["headers"]["Accept-Encoding"] = "gzip, deflate"
    params["headers"]["Referer"] = "https://www.google.com/"

    cb_val = random.randint(20230000, 20249999)
    params["cookies"]["CONSENT"] = f"YES+cb.{cb_val}-04-p0.{lang}+FX+414"
    params["cookies"]["SOCS"] = "CAESHAgBEhJmb3NfbGVzcy9zZWFyY2gvaG9tZQ"


async def response(resp):
    results = []
    html = resp.text

    # Check if blocked (redirected to JS challenge or captcha)
    is_blocked, _ = detect_block(html, resp.status_code, resp.url)

    if not is_blocked:
        tree = HTMLParser(html)

        # Strategy 1: Mobile GSA layout — containers with h3 titles
        # GSA returns divs with class Gx5Zad, xpd, etc.
        selector_sets = [
            # Modern mobile GSA layout
            ("div.Gx5Zad, div.xpd, div.BVG0Nb", "h3, .vv14be, .DKV0Md", "div.BNeawe.s31JSe, div.iCjJK, .BNeawe"),
            # Desktop/alternate layout
            ("div.MjjYud, div.g", "h3.LC20lb, h3", "div.VwiC3b, div.lEBKkf"),
            # Fallback containers
            ("div.egMi0, div.kCrYT", "h3, div.BNeawe.vv14be", "div.BNeawe.s3v9rd, div.BNeawe"),
        ]

        seen_urls = set()

        for container_sel, title_sel, snippet_sel in selector_sets:
            for node in tree.css(container_sel):
                title_node = node.css_first(title_sel)
                url_node = node.css_first("a[href]")
                snippet_node = node.css_first(snippet_sel)

                if not title_node or not url_node:
                    continue

                url = _clean_url(url_node.attributes.get("href", ""))
                if not _valid_url(url) or url in seen_urls:
                    continue

                title = title_node.text().strip()
                if not title or len(title) < 4:
                    continue

                seen_urls.add(url)
                results.append({
                    "title": title,
                    "url": url,
                    "content": snippet_node.text().strip() if snippet_node else "",
                    "source": "google",
                })

            if results:
                break

        # Strategy 2: Fallback — any h3 that has an ancestor <a> link
        if not results:
            for h3 in tree.css("h3"):
                node = h3.parent
                limit = 6
                while node and node.tag != "a" and limit > 0:
                    node = node.parent
                    limit -= 1

                if node and node.tag == "a":
                    url = _clean_url(node.attributes.get("href", ""))
                    if _valid_url(url) and url not in seen_urls:
                        title = h3.text().strip()
                        if title and len(title) > 4:
                            seen_urls.add(url)
                            results.append({
                                "title": title,
                                "url": url,
                                "content": "",
                                "source": "google",
                            })

    # Fallback to Brave/DDG if Google is blocked or returns 0 results
    if not results or is_blocked:
        try:
            lang = resp.search_params.get("language", "es")
            fallback_results = await fetch_fallback_search(resp.search_params.get("query", ""), lang, resp.client)
            for r in fallback_results:
                r["source"] = "google"
                results.append(r)
        except Exception as e:
            print(f"Google fallback failed: {e}")

    return results


def _clean_url(url: str) -> str:
    """Clean Google redirect and tracking URLs."""
    if not url:
        return ""
    if url.startswith("/url?q="):
        url = unquote(url[7:].split("&sa=")[0])
    elif "/url?esrc=" in url and "url=" in url:
        try:
            url = unquote(url.split("url=")[1].split("&")[0])
        except Exception:
            pass
    return url


def _valid_url(url: str) -> bool:
    """Check if URL is a valid external search result."""
    return (
        url.startswith("http")
        and "google.com" not in url
        and "google." not in url[:22]
        and len(url) > 10
    )
