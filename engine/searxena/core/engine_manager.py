import importlib
import os
import sys
import asyncio
import httpx
import json
import time
from typing import List, Dict, Any, Set
from collections import defaultdict

from utils import gen_useragent

class EngineManager:
    def __init__(self, base_dir: str):
        self.base_dir = base_dir
        self.settings_path = os.path.join(base_dir, "settings.json")
        self.engines_dir = os.path.join(base_dir, "engines")
        self.settings = self.load_settings()
        self.engines = {}
        self._cache = {} 
        self._client = None
        self.load_engines()

        # Bangs map (SearXNG style)
        self.bangs = {
            "!g": "google", "!w": "wikipedia", "!yt": "youtube", 
            "!gh": "github", "!so": "stackoverflow", "!i": "images",
            "!n": "news", "!ddg": "duckduckgo", "!bi": "bing",
            "!red": "reddit", "!py": "pypi", "!npm": "npm",
            "!qw": "qwant", "!wa": "wolframalpha", "!v": "videos",
            "!sc": "swisscows", "!ec": "ecosia", "!mo": "mojeek",
            "!sp": "startpage", "!ya": "yahoo", "!ak": "ask",
            "!ba": "baidu", "!na": "naver", "!se": "seznam",
            "!gb": "gigablast", "!ar": "arxiv", "!md": "mdn",
            "!pd": "pydoc", "!gl": "gitlab", "!sf": "sourceforge",
            "!do": "docker", "!eb": "ebay", "!wh": "wallhaven",
            "!ls": "librestock", "!fl": "flickr", "!gp": "giphy",
            "!pi": "pinterest", "!un": "unsplash"
        }

        # Ad-block global list (SearXNG style)
        self.ad_patterns = [
            "googleads", "pagead", "doubleclick", "partner.googleadservices",
            "adservice", "sponsored", "ads-", "ad-content", "amazon-ad", 
            "bingads", "yandex.ru/ads", "facebook.com/ads", "taboola", 
            "outbrain", "aclk?", "gampad/"
        ]
        
        # User-Agent rotation list (if needed globally)
        self.ua_list = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        ]

    def load_settings(self):
        try:
            if not os.path.exists(self.settings_path):
                return self.get_default_settings()
            with open(self.settings_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return self.get_default_settings()

    def get_default_settings(self):
        return {
            "general": {"timeout": 4.0, "cache_ttl": 600, "instance_name": "searXena"},
            "engines": []
        }

    def save_settings(self, new_settings):
        try:
            with open(self.settings_path, 'w', encoding='utf-8') as f:
                json.dump(new_settings, f, indent=4)
            self.settings = new_settings
        except Exception:
            pass

    async def get_client(self):
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                follow_redirects=True, 
                timeout=self.settings["general"].get("timeout", 4.0),
                limits=httpx.Limits(max_keepalive_connections=100, max_connections=500),
                http2=True,
                verify=False # Mantener compatibilidad pero en un pool único
            )
        return self._client

    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None
        # También cerrar el cliente de sugerencias si fue importado
        if "engines.suggestions" in sys.modules:
            sugg = sys.modules["engines.suggestions"]
            if hasattr(sugg, "client") and hasattr(sugg.client, "aclose"):
                await sugg.client.aclose()

    def _prune_cache(self):
        """Limpia el cache de entradas expiradas para evitar fugas de memoria."""
        if len(self._cache) < 500: return
        now = time.time()
        expired = [k for k, v in self._cache.items() if now >= v[1]]
        for k in expired:
            del self._cache[k]
        
        # Si aún es muy grande, limpiar por LRU (simulado con borrado de las más viejas)
        if len(self._cache) > 1000:
            keys = list(self._cache.keys())
            for k in keys[:200]:
                del self._cache[k]

    def load_engines(self):
        if self.base_dir not in sys.path:
            sys.path.insert(0, self.base_dir)
            
        config_engines = {e["name"]: e for e in self.settings.get("engines", [])}

        for filename in os.listdir(self.engines_dir):
            if filename.endswith(".py") and not filename.startswith("__") and filename != "suggestions.py":
                engine_name = filename[:-3]
                try:
                    if f"engines.{engine_name}" in sys.modules:
                        importlib.reload(sys.modules[f"engines.{engine_name}"])
                    module = importlib.import_module(f"engines.{engine_name}")
                    
                    # Module defaults
                    default_enabled = getattr(module, "ENABLED", True)
                    default_categories = getattr(module, "CATEGORIES", ["general"])
                    default_weight = getattr(module, "WEIGHT", 1.0)

                    cfg = config_engines.get(engine_name, {})
                    module.ENABLED = cfg.get("enabled", default_enabled)
                    module.CATEGORIES = cfg.get("categories", default_categories)
                    module.WEIGHT = cfg.get("weight", default_weight)
                    module.NAME = engine_name
                    
                    if hasattr(module, "request") and hasattr(module, "response"):
                        self.engines[engine_name] = module
                except Exception:
                    pass

    async def search(self, query: str, category: str = "general", pageno: int = 1, lang: str = None, include_engines: list = None, exclude_engines: list = None):
        # 1. Handle Bangs
        target_engine = None
        clean_query = query
        for bang, engine_name in self.bangs.items():
            if query.startswith(bang + " "):
                target_engine = engine_name
                clean_query = query[len(bang)+1:]
                break
            elif query.endswith(" " + bang):
                target_engine = engine_name
                clean_query = query[:-len(bang)-1]
                break

        # 2. Check Cache
        # Incluimos idioma y filtros en la llave para evitar colisiones, pero NO el limit,
        # ya que el limit se aplica en la capa de la API sobre el set completo cacheado.
        cache_key = f"{clean_query}:{category}:{pageno}:{target_engine}:{lang}:{include_engines}:{exclude_engines}"
        now = time.time()
        if cache_key in self._cache:
            results, expiry = self._cache[cache_key]
            if now < expiry:
                return results

        # 3. Parallel Search - Mejor selección de motores (Estilo SearXNG)
        tasks = []
        timeout_limit = self.settings["general"].get("timeout", 4.0)
        
        # Filtro de motores por categoría (Mejorado)
        category_engines = []
        include_engines = include_engines or []
        exclude_engines = exclude_engines or []

        for name, engine in self.engines.items():
            if exclude_engines and name in exclude_engines:
                continue
            if include_engines and name not in include_engines:
                continue
            
            # Si incluimos explícitamente motores, saltamos el check de categoría si es general o específico.
            real_category = "it_science" if category == "it" else category
            if include_engines:
                category_engines.append(engine)
            elif engine.ENABLED and real_category in engine.CATEGORIES:
                category_engines.append(engine)
        
        # Si no hay motores en la categoría, o si es la categoría maps (requiere apoyo), buscar en general (Fallback)
        if (not category_engines and not include_engines) or category == "maps":
            for name, engine in self.engines.items():
                if exclude_engines and name in exclude_engines:
                    continue
                if engine.ENABLED and "general" in engine.CATEGORIES and engine not in category_engines:
                    category_engines.append(engine)
                    
        # PRIORIZACIÓN (SearXNG): 
        # No corremos todos los motores a la vez si son masivos, 
        # ordenamos por PESO y tomamos los mejores para evitar latencias extremas.
        category_engines.sort(key=lambda x: x.WEIGHT, reverse=True)
        # Pool ampliado (SearXNG suele correr 20+ pero aquí mantendremos 15 por CPU)
        selection = category_engines[:15]
        
        if target_engine and target_engine in self.engines:
             tasks = [self.call_engine(self.engines[target_engine], clean_query, category, pageno, timeout_limit, lang=lang)]
        else:
            for engine in selection:
                tasks.append(self.call_engine(engine, clean_query, category, pageno, timeout_limit, lang=lang))

        # Parallel Wait (Buscamos que sean ultra-veloces)
        try:
            # Añadimos un pequeño margen sobre el timeout_limit para que wait_for no mate antes de tiempo el httpx interno
            results_list = await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=timeout_limit + 1.0
            )
            valid_results = [r for r in results_list if isinstance(r, list)]
        except asyncio.TimeoutError:
            # Si el gather masivo falla, cancelamos todo para evitar h6uerfanos
            for t in tasks:
                if not t.done():
                    t.cancel()
            valid_results = []
        except Exception:
            valid_results = []
        
        # 4. Prune Cache periodically
        if int(now) % 10 == 0:
            self._prune_cache()

        results, infoboxes = self.process_and_rank(valid_results, category, clean_query)
        
        # Cache Result
        ttl = self.settings["general"].get("cache_ttl", 600)
        self._cache[cache_key] = ((results, infoboxes), now + ttl)
        
        return results, infoboxes

    async def call_engine(self, engine, query, category, pageno, timeout_limit, lang=None):
        try:
            params = {
                "query": query,
                "pageno": pageno,
                "category": category,
                "safesearch": self.settings.get("general", {}).get("safe_search", 1),
                "language": lang or self.settings.get("general", {}).get("default_lang", "es"),
                "time_range": None,
                "url": None,
                "method": "GET",
                "headers": {
                    "User-Agent": gen_useragent(),
                    "Accept-Language": f"{lang or self.settings.get('general', {}).get('default_lang', 'es')},en;q=0.8",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                    "Connection": "keep-alive"
                },
                "data": {},
                "cookies": {},
                "timeout": timeout_limit,
                "engine_data": {},
                "client": await self.get_client()
            }
            
            # Ejecutar lógica del motor
            if hasattr(engine, "request_categorized"):
                if asyncio.iscoroutinefunction(engine.request_categorized):
                    await engine.request_categorized(query, category, params)
                else:
                    engine.request_categorized(query, category, params)
            else:
                if asyncio.iscoroutinefunction(engine.request):
                    await engine.request(query, params)
                else:
                    engine.request(query, params)
            
            results = []
            if params.get("url") and params["url"].startswith("internal://"):
                class FakeResponse:
                    def __init__(self, p):
                        self.text = ""
                        self.status_code = 200
                        self.search_params = p
                        self.url = p["url"]
                        self.client = p["client"]
                    def json(self): return {}
                if asyncio.iscoroutinefunction(engine.response):
                    results = await engine.response(FakeResponse(params))
                else:
                    results = engine.response(FakeResponse(params))
            elif params.get("url"):
                client = await self.get_client()
                if params["method"] == "POST":
                    resp = await client.post(params["url"], data=params["data"], headers=params["headers"], cookies=params["cookies"], timeout=params["timeout"])
                else:
                    resp = await client.get(params["url"], headers=params["headers"], cookies=params["cookies"], timeout=params["timeout"])
                
                engine_name = getattr(engine, "NAME", engine.__name__.split('.')[-2] if '.' in engine.__name__ else engine.__name__)
                if engine_name in ["google", "bing", "duckduckgo"]:
                        print(f"DEBUG: {engine_name} status: {resp.status_code}")
                
                if resp.status_code in [200, 202]:
                    class ResponseWrapper:
                        def __init__(self, r, p):
                            self.text = r.text
                            self.status_code = r.status_code
                            self.search_params = p
                            self.url = str(r.url)
                            self.client = p["client"]
                        def json(self):
                            return json.loads(self.text)
                    
                    if asyncio.iscoroutinefunction(engine.response):
                        results = await engine.response(ResponseWrapper(resp, params))
                    else:
                        results = engine.response(ResponseWrapper(resp, params))
                
            clean = []
            if results and asyncio.iscoroutine(results):
                results = await results
            
            if isinstance(results, list):
                engine_name = getattr(engine, "NAME", engine.__name__.split('.')[-1])
                engine_weight = getattr(engine, "WEIGHT", 1.0)
                for r in results:
                    r["source"] = engine_name
                    r["engine_weight"] = engine_weight
                    if self.is_legit(r):
                        clean.append(r)
            return clean
        except Exception as e:
            eng_name = getattr(engine, "NAME", "unknown")
            print(f"ERROR in engine {eng_name}: {repr(e)}")
            import traceback
            traceback.print_exc()
            return []

    def is_legit(self, result: Dict) -> bool:
        url = result.get('url', '').lower()
        title = result.get('title', '').lower()
        content = result.get('content', '').lower()

        # 1. Filtrado de anuncios (Solo si el patrón es muy específico o en URL)
        for pattern in self.ad_patterns:
            if pattern in url:
                return False
            # Solo filtrar por título/contenido si es corto (anuncios típicos)
            if (pattern in title and len(title) < 40) or (pattern in content[:20]):
                return False
                
        # 2. Relaxed Legitimacy - No tirar resultados legítimos
        if len(title) < 3: return False
        if "..." in title and len(title) < 15: return False
        
        # 3. Solo URLs de confianza o útiles
        if not url.startswith('http') and not url.startswith('#'):
            return False
            
        return True

    def process_and_rank(self, results_groups, category="general", query=""):
        score_map = defaultdict(lambda: {"title": "", "url": "", "content": "", "score": 0.0, "sources": set(), "engine_positions": []})
        infoboxes = [] # Resultados destacados (Wiki, Calculadora, OSM)
        
        # Normalizar query para validación de relevancia
        import re
        q_norm = re.sub(r'[^\w\s]', '', query.lower()).strip()
        q_words = set(q_norm.split())
        
        for results in results_groups:
            for position, res in enumerate(results):
                # 1. Extraer INFOTOOLS (Respuestas Destacadas Reales)
                if res.get("template") == "infobox.html":
                    # VALIDACIÓN DE RELEVANCIA PARA INFOBOXES
                    # Evitar mostrar infoboxes de "coincidencia parcial" como destacados
                    # Ejemplo: Query "openclaw" vs Título "Claw (videojuego)" -> No es match perfecto.
                    res_title = res.get("title", "").lower()
                    title_norm = re.sub(r'\(.*?\)', '', res_title) # Quitar (videojuego), etc.
                    title_norm = re.sub(r'[^\w\s]', '', title_norm).strip()
                    t_words = set(title_norm.split())

                    # Criterio: El infobox debe contener la esencia de la búsqueda
                    # Si la query es una palabra única y el título no es igual -> Descartar de destacados
                    is_relevant = False
                    # Caso 1: Match Exacto
                    if q_norm == title_norm or q_norm.replace(' ','') == title_norm.replace(' ',''):
                        is_relevant = True
                    # Caso 2: Solapamiento significativo o contención
                    elif q_words.issubset(t_words) or t_words.issubset(q_words):
                        is_relevant = True
                    elif len(q_words) > 1: 
                        intersection = q_words.intersection(t_words)
                        if len(intersection) / len(q_words) >= 0.6:
                            is_relevant = True

                    if is_relevant:
                        if not any(i['title'] == res['title'] and i['source'] == res['source'] for i in infoboxes):
                            infoboxes.append(res)
                        continue # Ya está en infoboxes, no procesar como resultado normal
                    else:
                        # Si no es suficientemente relevante para ser infobox, 
                        # degradar a resultado estándar para no perder la información
                        res["template"] = "default"


                # 2. Normalización de URL para deduplicación robusta (SearXNG style)
                raw_url = res.get('url', '')
                if not raw_url: continue
                
                # Normalización agresiva: quitar fragmentos, protocolos y parámetros de rastreo/idioma comunes
                # para que 'example.com/?hl=es' y 'example.com/?hl=en' colapsen en el mismo resultado
                u = raw_url.lower().replace('https://', '').replace('http://', '').replace('www.', '').split('#')[0]
                
                # Quitar parámetros de URL comunes que duplican el mismo contenido
                if '?' in u:
                    base, query = u.split('?', 1)
                    params = query.split('&')
                    # Filtramos parámetros de idioma y tracking
                    valid_params = [p for p in params if not any(p.startswith(x) for x in ['hl=', 'gl=', 'lr=', 'lang=', 'language=', 'utm_', 'fbclid='])]
                    u = base + ('?' + '&'.join(valid_params) if valid_params else '')
                
                clean_url = u.rstrip('/')
                if not clean_url: continue
                
                item = score_map[clean_url]
                
                # Preservar el título más limpio y descripción más rica
                if not item["title"] or (len(res.get('content', '')) > len(item.get('content', '')) and len(res.get('title', '')) > 5):
                    for key, val in res.items():
                        if key not in ["score", "sources", "engine_positions"]:
                            item[key] = val
                
                # 3. Ranking Armónico Ponderado
                # SearXNG recompensa mucho aparecer en el TOP 1 de cualquier motor confiable.
                engine_weight = res.get("engine_weight", 1.0)
                source_engine = res.get("source", "")
                
                # Ajustes Dinámicos de Pesos por Categoría
                if category == "it":
                    # Reducir drásticamente el peso de motores ruidosos/repositorios en IT
                    if source_engine in ["github", "npm", "mdn", "arxiv"]:
                        engine_weight *= 0.2
                    # Aumentar peso de motores con menos ruido / alta curación
                    elif source_engine in ["hackernews", "wikipedia", "stackoverflow"]:
                        engine_weight *= 1.5
                
                # Bonus por Dominios de Autoridad Superior
                auth_bonus = 1.0
                trusted_list = [".edu", ".org", ".gov", "wikipedia.org", "reuters.com", "arxiv.org", "stackoverflow.com", "github.com"]
                if any(ext in clean_url for ext in trusted_list):
                    auth_bonus = 1.25
                
                # Descuento en dominios ruidosos de IT (Uncondicional)
                if category == "it" and any(d in clean_url for d in ["github.com", "npmjs.com", "github.io", "developer.mozilla.org", "arxiv.org"]):
                    auth_bonus *= 0.15 # Castigo severo directo a la URL de repositorios o crudos
                
                # Penalización por snippets "con puntos suspensivos" iniciales que no aportan valor
                snippet_penalty = 1.0
                content = res.get('content', '')
                if content.startswith('...') or len(content) < 40:
                    snippet_penalty = 0.8

                # Fórmula: (Peso Motor * Bonus Auth * Snippet Penalty) / Raiz(Posición + 1)
                # La raíz cuadrada de la posición suaviza la caída de relevancia, pero prioriza el top 3.
                item["score"] += (engine_weight * auth_bonus * snippet_penalty) / ((position + 1) ** 0.5)
                item["sources"].add(res['source'])
                item["engine_positions"].append(position)
        
        # 4. Consolidar y Aplicar Bonus de Diversidad (Si aparece en muchos motores)
        final = []
        for url, data in score_map.items():
            data["sources"] = list(data["sources"])
            # Bonus de Consenso: Si aparece en muchos motores, es fiable.
            consensus_bonus = 1.0 + (0.5 * (len(data["sources"]) - 1))
            data["score"] *= consensus_bonus
            
            # Penalización por URL de poca profundidad (homes/meta-urls suelen ser menos relevantes que artículos)
            if url.count('/') < 2: data["score"] *= 0.85

            final.append(data)
            
        # Ordenación de Infoboxes por relevancia (Perfect Match primero)
        def infobox_sort_score(i):
            title = re.sub(r'[^\w\s]', '', i.get('title', '').lower()).strip()
            q_fix = q_norm.replace(' ', '')
            t_fix = title.replace(' ', '')
            
            # Puntuación: 0 = Perfect, 1 = Substring, 2 = Partial
            base = 2
            if i.get('source') == 'osm':
                base = -1  # Mapas siempre pasan como respuesta destacada
            elif q_fix == t_fix: base = 0
            elif q_fix in t_fix or t_fix in q_fix: base = 1
            
            # Tie-breaker decimal: Wikipedia > Wikidata > Otros
            prio = 0.5
            if i.get('source') == 'wikipedia': prio = 0.1
            elif i.get('source') == 'wikidata': prio = 0.2
            
            return base + prio
        
        infoboxes.sort(key=infobox_sort_score)
        
        # Permitir múltiples infoboxes (hasta 3 en general, 5 en mapas)
        final_infoboxes = []
        if infoboxes:
            for info in infoboxes:
                if infobox_sort_score(info) < 2.0:
                    final_infoboxes.append(info)
                
                max_infoboxes = 5 if category == 'maps' else 3
                if len(final_infoboxes) >= max_infoboxes:
                    break
        
        # Ordenación Final de resultados por Score
        final.sort(key=lambda x: x["score"], reverse=True)
        
        # Limitar resultados para limpieza absoluta
        limited_results = final[:40]
        
        return limited_results, final_infoboxes
