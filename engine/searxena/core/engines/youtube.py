from json import loads, dumps
from urllib.parse import quote_plus
from functools import reduce
from utils import extr

CATEGORIES = ['videos', 'music']
WEIGHT = 1.5

BASE_YOUTUBE_URL = 'https://www.youtube.com/watch?v='
SEARCH_URL = 'https://www.youtube.com/results?search_query={query}&page={page}'
NEXT_PAGE_URL = 'https://www.youtube.com/youtubei/v1/search?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'

def request(query, params):
    lang = params.get("language", "es")
    gl = lang.upper() if len(lang) == 2 else "US"
    
    params['cookies']['CONSENT'] = f"YES+cb.20240101-04-p0.{lang}+FX+414"
    params['url'] = SEARCH_URL.format(query=quote_plus(query), page=params['pageno']) + f"&hl={lang}&gl={gl}"
    
    # Soporte para rango de tiempo si es necesario
    time_map = {'day': 'Ag', 'week': 'Aw', 'month': 'BA', 'year': 'BQ'}
    tr = params.get('time_range')
    if tr in time_map:
        params['url'] += f"&sp=EgII{time_map[tr]}%253D%253D"
        
    return params

def response(resp):
    results = []
    # YouTube mete los resultados en un objeto JSON dentro de un script tag
    results_data = extr(resp.text, 'ytInitialData = ', ';</script>')
    if not results_data:
        return []

    try:
        results_json = loads(results_data)
        sections = (
            results_json.get('contents', {})
            .get('twoColumnSearchResultsRenderer', {})
            .get('primaryContents', {})
            .get('sectionListRenderer', {})
            .get('contents', [])
        )

        for section in sections:
            for video_container in section.get('itemSectionRenderer', {}).get('contents', []):
                video = video_container.get('videoRenderer', {})
                videoid = video.get('videoId')
                if videoid:
                    url = BASE_YOUTUBE_URL + videoid
                    thumbnail = f'https://i.ytimg.com/vi/{videoid}/hqdefault.jpg'
                    
                    title = _get_text(video.get('title', {}))
                    content = _get_text(video.get('descriptionSnippet', {}))
                    author = _get_text(video.get('ownerText', {}))
                    length = _get_text(video.get('lengthText', {}))

                    results.append({
                        'template': 'videos.html',
                        'url': url,
                        'title': title,
                        'content': f"{author} • {length} • {content}" if content else f"{author} • {length}",
                        'img_src': thumbnail,
                        'iframe_src': f'https://www.youtube-nocookie.com/embed/{videoid}',
                        'source': 'youtube'
                    })
    except Exception:
        pass

    return results

def _get_text(element):
    if not element: return ""
    if 'runs' in element:
        return reduce(lambda a, b: a + b.get('text', ''), element.get('runs'), '')
    return element.get('simpleText', '')
