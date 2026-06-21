"""
Google Videos engine.
Uses GSA User-Agent to bypass JS-redirect blocks.
Extracts video results from the mobile GSA HTML structure.
"""
import re
import random
from urllib.parse import urlencode, unquote
from utils import LANGUAGE_MAP
from selectolax.parser import HTMLParser

CATEGORIES = ["videos"]
WEIGHT = 2.0

_GSA_UAS = [
    "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.105 Mobile Safari/537.36 NSTNWV",
    "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Mobile Safari/537.36 NSTNWV",
    "Mozilla/5.0 (Linux; Android 7.0; SM-G892A Build/NRD90M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Mobile Safari/537.36 NSTNWV",
    "Mozilla/5.0 (Linux; Android 8.0; Pixel 2 Build/OPD3.170816.012) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Mobile Safari/537.36 NSTNWV",
    "Mozilla/5.0 (Linux; Android 9; SM-G960F Build/PPR1.180610.011) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36 NSTNWV",
]

_YT_THUMB = "https://i.ytimg.com/vi/{vid_id}/mqdefault.jpg"
_YT_PATTERN = re.compile(r"(?:v=|/)([0-9A-Za-z_-]{11})(?:[&?/]|$)")


def request(query, params):
    start = (params.get("pageno", 1) - 1) * 10
    lang = params.get("language", "es")
    lang_code = LANGUAGE_MAP.get("google", {}).get(lang, "es")
    country = lang_code.upper() if len(lang_code) == 2 else "US"

    query_params = {
        "q": query,
        "tbm": "vid",
        "start": start,
        "hl": lang_code,
        "gl": country,
        "num": 10,
    }
    params["url"] = f"https://www.google.com/search?{urlencode(query_params)}"
    params["headers"]["User-Agent"] = random.choice(_GSA_UAS)
    params["headers"]["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
    params["headers"]["Accept-Language"] = f"{lang_code},en;q=0.7"
    params["headers"]["Accept-Encoding"] = "gzip, deflate"
    params["headers"]["Referer"] = "https://www.google.com/"

    cb_val = random.randint(20230000, 20249999)
    params["cookies"]["CONSENT"] = f"YES+cb.{cb_val}-04-p0.{lang}+FX+414"
    params["cookies"]["SOCS"] = "CAESHAgBEhJmb3NfbGVzcy9zZWFyY2gvaG9tZQ"


def response(resp):
    results = []
    html = resp.text

    if "httpservice/retry/enablejs" in html:
        return results

    tree = HTMLParser(html)
    seen_urls = set()

    # Mobile GSA video results: multiple possible container layouts
    selector_sets = [
        # Mobile GSA layout
        ("div.Gx5Zad, div.xpd, div.BVG0Nb", "h3, .vv14be, .DKV0Md", "div.BNeawe.s31JSe, div.iCjJK"),
        # Desktop-like fallback
        ("div.MjjYud, div.g", "h3", "div.VwiC3b"),
        # Generic fallback
        ("div.RzdJxc, div.ct3b9e", "h3", "div.tvCtae"),
    ]

    for container_sel, title_sel, snippet_sel in selector_sets:
        for node in tree.css(container_sel):
            title_node = node.css_first(title_sel)
            url_node = node.css_first("a[href]")
            snippet_node = node.css_first(snippet_sel)
            img_node = node.css_first("img")

            if not title_node or not url_node:
                continue

            url = _clean_url(url_node.attributes.get("href", ""))
            if not _valid_url(url) or url in seen_urls:
                continue

            title = title_node.text().strip()
            if not title or len(title) < 4:
                continue

            # Get thumbnail
            img_src = _get_thumbnail(url, img_node)

            seen_urls.add(url)
            results.append({
                "template": "videos.html",
                "title": title,
                "url": url,
                "img_src": img_src,
                "content": snippet_node.text().strip() if snippet_node else "",
                "source": "google_videos",
            })

        if results:
            break

    # Fallback: h3-based extraction (same as general)
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
                            "template": "videos.html",
                            "title": title,
                            "url": url,
                            "img_src": _get_thumbnail(url, None),
                            "content": "",
                            "source": "google_videos",
                        })

    return results


def _get_thumbnail(url: str, img_node) -> str | None:
    """Extract YouTube thumbnail or use whatever img is available."""
    if url and ("youtube.com" in url or "youtu.be" in url):
        m = _YT_PATTERN.search(url)
        if m:
            return _YT_THUMB.format(vid_id=m.group(1))

    if img_node:
        src = (
            img_node.attributes.get("src")
            or img_node.attributes.get("data-src")
            or img_node.attributes.get("data-iurl")
        )
        if src and src.startswith("http"):
            return src

    return None


def _clean_url(url: str) -> str:
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
    return (
        url.startswith("http")
        and "google.com" not in url
        and "google." not in url[:22]
        and len(url) > 10
    )
