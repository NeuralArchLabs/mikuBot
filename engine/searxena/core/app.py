from fastapi import FastAPI, Request, Form, Response, Query, Body
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Any
import uvicorn
import os
import json
from engine_manager import EngineManager
import engines.suggestions as suggestions

from urllib.parse import quote_plus, urlparse
import re

from contextlib import asynccontextmanager

# Configuración de base
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Inicializar EngineManager con persistencia
manager = EngineManager(BASE_DIR)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: El manager ya se inicializa arriba, pero podríamos moverlo aquí si quisiéramos
    yield
    # Shutdown: Cerrar conexiones abiertas y limpiar tareas
    await manager.close()

app = FastAPI(title="searXena", lifespan=lifespan)

app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

# Register filters
templates.env.filters["urlencode"] = lambda s: quote_plus(str(s)) if s else ""

@app.get("/")
async def index(request: Request):
    lang = manager.settings.get("general", {}).get("default_lang", "es")
    return templates.TemplateResponse("index.html", {"request": request, "lang": lang})

@app.get("/robots.txt")
async def robots():
    return Response(content=open(os.path.join(BASE_DIR, "static", "robots.txt")).read(), media_type="text/plain")

@app.get("/ai.txt")
async def ai_txt():
    return Response(content=open(os.path.join(BASE_DIR, "static", "ai.txt")).read(), media_type="text/plain")

@app.get("/autoc")
async def autocomplete(q: str = ""):
    results = await suggestions.get_suggestions(q)
    return JSONResponse(results)

@app.get("/settings")
async def get_settings(request: Request):
    engine_list = []
    for name, module in manager.engines.items():
        engine_list.append({
            "name": name,
            "enabled": module.ENABLED,
            "categories": module.CATEGORIES,
            "weight": module.WEIGHT
        })
    general_settings = manager.settings.get("general", {})
    return templates.TemplateResponse("settings.html", {
        "request": request, 
        "engines": engine_list,
        "general": general_settings,
        "lang": manager.settings.get("general", {}).get("default_lang", "es")
    })

@app.post("/save_settings")
async def save_settings(request: Request):
    form = await request.form()
    enabled_engines = form.getlist("engines")
    
    current = manager.settings
    if "engines" not in current:
        current["engines"] = []
        
    # Guardar motores de forma segura y evitar conflictos de categorías
    for name, module in manager.engines.items():
        found = False
        for cfg in current["engines"]:
            if cfg.get("name") == name:
                cfg["enabled"] = name in enabled_engines
                # Eliminar las categorías cacheadas en JSON si existen, para que siempre lea del .py
                if "categories" in cfg:
                    del cfg["categories"]
                found = True
                break
        if not found:
            current["engines"].append({
                "name": name,
                "enabled": name in enabled_engines
            })
    
    # Guardar preferencias generales
    general = current.get("general", {})
    general["safe_search"] = int(form.get("safesearch", 0))
    general["default_lang"] = form.get("language", "es")
    general["autocomplete"] = form.get("autocomplete", "google")
    current["general"] = general

    manager.save_settings(current)
    manager.load_engines() 
    
    return RedirectResponse(url="/settings", status_code=303)

import httpx
import random
from fastapi.responses import StreamingResponse

@app.get("/proxify")
async def proxify(url: str):
    """Proxy local para imágenes y recursos externos para proteger la IP del usuario."""
    if not url: return Response(status_code=400)
    
    # Intentar limpiar URLs de Google que a veces vienen mal
    if "google.com/url?q=" in url:
        from urllib.parse import unquote
        url = unquote(url.split("?q=")[1].split("&")[0])
        
    # Arreglar URLs relativas de Wikipedia
    if url.startswith("//"):
        url = "https:" + url

    async def stream_resource():
        client = await manager.get_client()
        try:
            # Limitar tamaño de descarga a 10MB para evitar OOM y abusos
            max_size = 10 * 1024 * 1024
            downloaded = 0
            async with client.stream("GET", url, timeout=10.0) as resp:
                if resp.status_code == 200:
                    async for chunk in resp.aiter_bytes():
                        downloaded += len(chunk)
                        if downloaded > max_size:
                            break
                        yield chunk
        except Exception:
            pass

    headers = {
        "Cache-Control": "public, max-age=604800" # Cachear localmente por una semana
    }
    return StreamingResponse(stream_resource(), media_type="image/png", headers=headers)

# Meta-búsqueda orquestada con paginación
@app.get("/search")
@app.post("/search")
async def search(request: Request):
    q = request.query_params.get("q")
    category = request.query_params.get("category", "general")
    pageno = int(request.query_params.get("pageno", 1))
    
    if request.method == "POST":
        form = await request.form()
        q = q or form.get("q")
        category = category or form.get("category", "general")
        pageno = int(form.get("pageno", 1))
    if not q:
        return RedirectResponse(url="/")

    lang = manager.settings.get("general", {}).get("default_lang", "es")

    # Sistema de Bangs (SearXNG style)
    if q.startswith("!"):
        parts = q.split(" ", 1)
        bang = parts[0].lower()
        if bang in manager.bangs:
            target = manager.bangs[bang]
            q = parts[1] if len(parts) > 1 else ""
            if target in ["images", "videos", "news", "it", "shopping"]:
                category = target

    results, infoboxes = [], []
    related_searches = await suggestions.get_suggestions(q)
    
    if category == "shopping":
        # Modificar la query internamente para forzar a los motores generales a arrojar resultados comerciales
        search_q = q if any(w in q.lower() for w in ["comprar", "precio", "oferta", "tienda"]) else f"{q} comprar"
        
        # Petición única y normal, sin paginaciones dobles raras.
        results, infoboxes = await manager.search(search_q, category=category, pageno=pageno, lang=lang)
    else:
        results, infoboxes = await manager.search(q, category=category, pageno=pageno, lang=lang)
    
    # Filtrado y reorganización inteligente para compras
    reorganized = []
    
    # Dominios súper comunes para asegurar que entren aunque no tengan precio explícito en el snippet
    shopping_domains = ["amazon.", "ebay.", "mercadolibre.", "aliexpress.", "walmart.", "target.", "bestbuy.", "etsy.", "shopee.", "liverpool.", "coppel.", "steren.", "homedepot.", "cyberpuerta."]
    
    for r in results:
        # 1. Intentar extraer precio del snippet (Regex)
        if "price" not in r:
            match = re.search(r'([\$€£]\s?\d+[\.,]\d{2,3})', r.get("content", ""))
            if match:
                r["price"] = match.group(1)
                
        has_price = bool(r.get("price"))
        
        url = r.get("url", "")
        domain = urlparse(url).netloc.lower()
        is_shop_domain = any(sd in domain for sd in shopping_domains)
        
        # 2. Es producto si tiene precio, o si viene de una tienda conocida
        is_shop = has_price or is_shop_domain
        
        if is_shop:
            r["template"] = "shopping.html"
            if "shopping_store" not in r:
                r["shopping_store"] = domain.replace("www.", "").split(".")[0]
            if r.get("thumbnail_src") and not r.get("img_src"):
                r["img_src"] = r["thumbnail_src"]
        
        # 3. Filtrar
        if category == "shopping":
            if is_shop:
                reorganized.append(r)
        else:
            reorganized.append(r)
            
    if category == "shopping":
        results = reorganized
    
    # Los infoboxes (como OSM) son esenciales en General y Mapas
    if category in ["general", "maps"]:
        full_results = infoboxes + results
    else:
        full_results = results

    # Sistema de Sugerencias Pro dinámicas
    tips_pool = [
        {'en': 'Try using <b>!w</b> for Wikipedia.', 'es': 'Prueba usar <b>!w</b> para buscar en Wikipedia.', 'zh': '尝试使用<b>!w</b>搜维基百科。'},
        {'en': 'Use <b>!gh</b> to search projects on GitHub directly.', 'es': 'Usa <b>!gh</b> para buscar proyectos en GitHub directamente.', 'zh': '使用<b>!gh</b>直接搜GitHub。'},
        {'en': 'Looking for code? <b>!mdn</b> or <b>!npm</b> are your friends.', 'es': '¿Buscas código? <b>!mdn</b> o <b>!npm</b> son tus mejores amigos.', 'zh': '找代码？<b>!mdn</b> 或 <b>!npm</b> 是你的好帮手。'},
        {'en': 'Press <b>"Settings"</b> to enable more search engines.', 'es': 'Pulsa en <b>"Preferencias"</b> para habilitar más motores de búsqueda.', 'zh': '点击<b>“偏好设置”</b>开启更多引擎。'},
        {'en': 'Follow <a href="https://github.com/NeuralArchLabs" target="_blank" style="color:var(--accent);text-decoration:none;font-weight:bold;">NeuralArchLabs</a> on GitHub for more insane AI projects!', 'es': '¡Sigue a <a href="https://github.com/NeuralArchLabs" target="_blank" style="color:var(--accent);text-decoration:none;font-weight:bold;">NeuralArchLabs</a> en GitHub para más proyectos de IA increíbles!', 'zh': '在 GitHub 上关注 <a href="https://github.com/NeuralArchLabs" target="_blank" style="color:var(--accent);text-decoration:none;font-weight:bold;">NeuralArchLabs</a> 获取更多顶级 AI 项目！'},
        {'en': 'searXena 1.4.0 is now faster thanks to DMD architecture.', 'es': 'searXena 1.4.0 ahora es más rápido gracias a la arquitectura DMD.', 'zh': '得益于DMD架构，searXena 1.4.0 现在的速度更快了。'},
        {'en': 'Try <b>!yt</b> to search for videos on YouTube.', 'es': 'Prueba <b>!yt</b> para buscar videos en YouTube.', 'zh': '尝试使用<b>!yt</b>在YouTube搜视频。'},
        {'en': 'Privacy first: we never store your search history.', 'es': 'Privacidad primero: nunca guardamos tu historial de búsqueda.', 'zh': '隐私第一：我们从不存储您的搜索记录。'}
    ]
    random_tip = random.choice(tips_pool).get(lang, tips_pool[0]['en'])

    response = templates.TemplateResponse("results.html", {
        "request": request, 
        "query": q, 
        "results": full_results,
        "related_searches": related_searches,
        "category": category,
        "pageno": pageno,
        "lang": lang,
        "pro_tip": random_tip
    })
    
    # Cabeceras de Privacidad Estrictas
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    return response

# --- API endpoints para IA / LLMs ---

class ToolSearchRequest(BaseModel):
    query: str = Field(..., description="Término de búsqueda.")
    category: Optional[str] = Field("general", description="Categoría: general, images, videos, news, maps, shopping, it, social.")
    pageno: Optional[int] = Field(1, description="Número de página.")
    language: Optional[str] = Field(None, description="Código ISO (es, en, etc.).")
    include_engines: Optional[List[str]] = Field(None, description="Motores específicos a incluir.")
    exclude_engines: Optional[List[str]] = Field(None, description="Motores a ignorar.")
    limit: Optional[int] = Field(10, description="Límite de resultados para optimizar contexto.")

@app.post("/api/v1/search")
async def api_search(request_data: ToolSearchRequest):
    """
    Endpoint nativo en JSON estructurado para Agentes de IA
    """
    results, infoboxes = await manager.search(
        request_data.query,
        category=request_data.category,
        pageno=request_data.pageno,
        lang=request_data.language,
        include_engines=request_data.include_engines,
        exclude_engines=request_data.exclude_engines
    )
    
    keys_to_remove = [
        "template", "engine_positions", "score", "sources", 
        "engine_weight", "thumbnail_src", "prio", "is_shop",
        "shopping_store", "category"
    ]
    
    clean_results = []
    for r in infoboxes + results:
        clean_r = {k: v for k, v in r.items() if k not in keys_to_remove and v is not None}
        clean_results.append(clean_r)
        
    total = len(clean_results)
    limited = clean_results[:request_data.limit]
    
    return {
        "results": limited,
        "meta": {
            "total": total,
            "has_more": total > request_data.limit,
            "info": f"Mostrando {len(limited)} de {total}. Aumenta 'limit' si necesitas más." if total > request_data.limit else None
        }
    }

@app.get("/api/v1/tools_schema")
async def api_tools_schema():
    """
    Devuelve el esquema nativo de la herramienta para Agentes de IA.
    """
    engines_list = [name for name, _ in manager.engines.items()]
    return {
      "type": "function",
      "function": {
        "name": "searxena_search",
        "description": "Busca en la web. Solo requiere 'query'. Usa otros parámetros solo si es estrictamente necesario para ahorrar tokens.",
        "parameters": {
          "type": "object",
          "properties": {
            "query": {
              "type": "string",
              "description": "Término a buscar (ej: 'clima en Madrid')."
            },
            "category": {
              "type": "string",
              "enum": ["general", "images", "videos", "news", "maps", "shopping", "it", "social"],
              "description": "Opcional. Default: general."
            },
            "language": {
              "type": "string",
              "enum": ["es", "en", "it", "fr", "de", "zh", "pt", "ja"],
              "description": "Opcional. Idioma de búsqueda."
            },
            "limit": {
              "type": "integer",
              "description": "Opcional. Máximo de resultados (Default: 10)."
            }
          },
          "required": ["query"]
        }
      }
    }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
