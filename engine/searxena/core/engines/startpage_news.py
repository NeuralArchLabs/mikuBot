from selectolax.parser import HTMLParser
from urllib.parse import urlencode
from utils import LANGUAGE_MAP

CATEGORIES = ["news"]
WEIGHT = 1.0

def request(query, params):
    lang = params.get("language", "es")
    sp_lang = LANGUAGE_MAP.get("startpage", {}).get(lang, "english")
    
    query_params = {
        "query": query,
        "cat": "news",
        "cmd": "process_search",
        "language": sp_lang,
        "engine0": "v1all",
        "t": "device",
        "abp": "-1",
        "pg": params.get("pageno", 1),
    }
    params["url"] = "https://www.startpage.com/sp/search"
    params["method"] = "POST"
    params["data"] = query_params
    params["headers"]["Referer"] = "https://www.startpage.com/"
    params["headers"]["Origin"] = "https://www.startpage.com"
    params["headers"]["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    params["headers"]["Accept-Encoding"] = "gzip, deflate"
    params["cookies"]["preferences"] = "language_ui=english&search_engine=google&results_per_page=20"
    params["cookies"]["post_parameters"] = "1"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)

    # Startpage News
    for node in tree.css('div.article, .article, div.result, article.result'):
        title_link = node.css_first('a.article-title, a.result-link, h3 a, h2 a')
        snippet_node = node.css_first('p.article-snippet, p.description, .result-snippet')
        source_node = node.css_first('span.article-source, .source')
        time_node = node.css_first('span.article-date, .time, .date')

        if title_link:
            url = title_link.attributes.get('href', '')
            if url and url.startswith('http') and "startpage.com" not in url:
                source_txt = source_node.text().strip() if source_node else "Noticia"
                time_txt = time_node.text().strip() if time_node else ""
                
                content_prefix = f"{source_txt} ({time_txt}): " if time_txt else f"{source_txt}: "
                snippet_txt = snippet_node.text().strip() if snippet_node else ""
                
                results.append({
                    "title": title_link.text().strip(),
                    "url": url,
                    "content": content_prefix + snippet_txt,
                    "source": "startpage_news"
                })
    return results
