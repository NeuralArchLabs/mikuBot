"""
Google News engine using the official news.google.com RSS feed.
No blocking, no JS requirements, full results.
"""
import xml.etree.ElementTree as ET
from urllib.parse import urlencode, urljoin
from utils import LANGUAGE_MAP

CATEGORIES = ["news"]

# Maps language codes to Google News ceid format
_LANG_COUNTRY = {
    "es": ("es", "ES", "ES:es"),
    "en": ("en", "US", "US:en"),
    "fr": ("fr", "FR", "FR:fr"),
    "de": ("de", "DE", "DE:de"),
    "it": ("it", "IT", "IT:it"),
    "pt": ("pt", "PT", "PT:pt"),
    "ru": ("ru", "RU", "RU:ru"),
    "zh": ("zh-CN", "CN", "CN:zh-Hans"),
    "ja": ("ja", "JP", "JP:ja"),
    "ko": ("ko", "KR", "KR:ko"),
    "ar": ("ar", "AE", "AE:ar"),
}

def request(query, params):
    lang = params.get("language", "es")
    hl, gl, ceid = _LANG_COUNTRY.get(lang, ("es", "ES", "ES:es"))

    query_params = {
        "q": query,
        "hl": hl,
        "gl": gl,
        "ceid": ceid,
    }

    params["url"] = f"https://news.google.com/rss/search?{urlencode(query_params)}"
    params["headers"]["User-Agent"] = "Mozilla/5.0 (compatible; RSS reader)"
    params["headers"]["Accept"] = "application/rss+xml, application/xml, text/xml"


def response(resp):
    results = []

    try:
        root = ET.fromstring(resp.text)
    except ET.ParseError:
        return results

    for item in root.findall(".//item"):
        title = item.findtext("title", "").strip()
        link = item.findtext("link", "").strip()
        description = item.findtext("description", "").strip()
        pub_date = item.findtext("pubDate", "").strip()

        source_el = item.find("source")
        source_name = "Google News"
        source_url = ""
        if source_el is not None:
            if source_el.text:
                source_name = source_el.text.strip()
            source_url = source_el.attrib.get("url", "")

        # Clean HTML tags from description
        import re
        desc_clean = re.sub(r"<[^>]+>", "", description).strip()
        # Remove source appended at the end (Google adds " - Source Name")
        if source_name and desc_clean.endswith(source_name):
            desc_clean = desc_clean[: -len(source_name)].rstrip(" -").strip()

        if not title or not link:
            continue

        # Google's internal link always redirects to the real article
        url = link

        results.append({
            "title": title,
            "url": url,
            "content": desc_clean or f"Noticia de {source_name}",
            "publishedDate": pub_date,
            "source": "google_news",
        })

    return results
