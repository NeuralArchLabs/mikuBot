# Status Actual del Proyecto: searXena

Este documento sirve como la **fuente de verdad** para el estado del desarrollo, arquitectura y funcionamiento de searXena. Su objetivo es proporcionar contexto inmediato en cada sesión de programación.

## 🚀 Visión General
**searXena** es un metabuscador privado y motor de extracción (Reader Mode) diseñado para ser rápido, modular y respetuoso con la privacidad. Está inspirado en la arquitectura de SearXNG pero reconstruido de forma nativa en **FastAPI** para maximizar el rendimiento y la integración con agentes de IA.

---

## 🏗️ Arquitectura del Sistema

### 1. Núcleo (FastAPI - `core/app.py`)
El servidor backend gestiona:
- **Rutas de Búsqueda**: Orquestación de peticiones a motores concurrentes.
- **API v1**: Endpoints optimizados para herramientas de agentes de IA (JSON estructurado).
- **Modo Extractor**: Interfaz hacia el motor O-ZEN.
- **Proxy de Privacidad (`/proxify`)**: Servidor intermedio de imágenes para proteger la IP del usuario.

### 2. Gestión de Motores (`core/engine_manager.py`)
Lógica de bajo nivel para:
- **Carga Modular**: Los archivos en `core/engines/*.py` se cargan dinámicamente.
- **Ranking Armónico**: Los resultados de múltiples fuentes se deduplican y ordenan por relevancia, autoridad del dominio y consenso entre motores.
- **Soporte de Bangs**: Comandos rápidos como `!g` (Google), `!yt` (YouTube), `!w` (Wikipedia), etc.
- **Cache Local**: Sistema de caché en memoria con TTL configurable.

### 3. O-ZEN Engine (`core/ozen_engine/`)
Es el motor interno de extracción (rebranding de Trafilatura v2.0):
- **Funcionalidad**: Limpieza de HTML, extracción de metadatos, detección de idioma y generación de texto limpio/HTML minimalista.
- **Rescate Baseline**: Si falla la extracción estructural, usa un motor de respaldo basado en densidad de texto.
- **Reader Mode**: Integrado en la interfaz de usuario para lectura sin anuncios ni distracciones.

### 4. Frontend (Jinja2 + Vanilla JS)
- **Diseño**: Minimalista, moderno (fuente Outfit) y premium, con micro-animaciones SVG.
- **SPA Logic (`main.js`)**: Navegación fluida sin recargas completas, usando `sessionStorage` para cachear resultados de búsqueda.
- **Sidebar Dinámico**: Vista previa de resultados al hacer clic, con opción de "Modo Lectura" inmediata.

---

## 🛠️ Estado Tecnológico y Entorno

- **Lenguaje**: Python 3.x
- **Framework Web**: FastAPI + Uvicorn
- **Motor de Renderizado**: Jinja2
- **Análisis de HTML**: `selectolax` (ultra rápido) y `lxml`.
- **Cliente HTTP**: `httpx` (con soporte HTTP/2 para velocidad).
- **Entorno Local**: Instalado en `local\py3`.

---

## ✅ Mejoras y Fixes Recientes (24 de Marzo, 2026)

### 1. Resolución de Dependencias Críticas
Se identificó que el motor **O-ZEN** fallaba debido a librerías faltantes. Se añadieron e instalaron:
- `lxml`, `courlan`, `htmldate`, `justext`, `py3langid`, `brotli`, `zstandard`, `lxml_html_clean`.

### 2. Corrección de Firma en FastAPI/Starlette
Debido a una actualización en la dependencia `Starlette` (v1.0.0), las llamadas a `TemplateResponse` estaban provocando errores 500 (`TypeError: unhashable type: 'dict'`).
- **Solución**: Se actualizaron todas las llamadas en `app.py` para usar la firma moderna: `TemplateResponse(request, "template.html", context)`.

### 3. Estabilización de Arranque
El sistema ahora inicia correctamente mediante `.\run.ps1` y responde en el puerto `8000`.

---

## 📝 Notas para el Desarrollador
- **Motores Activos**: Google, Bing, DuckDuckGo, Brave, Wikipedia, etc.
- **Configuración**: Se usa `settings.example.json` como base si no existe `settings.json`.
- **Seguridad**: Cabeceras de `Referrer-Policy` y `X-Frame-Options` activas por defecto.
- **Extractor**: Centralizado en `core/extractor.py`, que encapsula la lógica compleja de O-ZEN.

---
*Última actualización: 24 de Marzo de 2026*
