# Plan de Implementación: OZENExtractor (Reader Mode)

Se ha integrado un sistema de extracción de contenido propio en **searXena**, siguiendo la arquitectura y mecanismos del motor **O-ZEN Engine** pero adaptado al estilo y stack tecnológico del proyecto (`selectolax`, `httpx`, `FastAPI`).

## 🛠️ Arquitectura Implementada

### 1. Capa de Adquisición (`core/extractor.py`)
- **Fetcher**: Utiliza `httpx` con soporte HTTP/2 y rotación de `User-Agent` (vía `core/utils.py`).
- **Resiliencia**: Manejo de timeouts y redirecciones automáticas.

### 2. Capa de Análisis y Limpieza
- **Motor**: `selectolax` (`LexborHTMLParser`) para un rendimiento hasta 10 veces superior a BeautifulSoup.
- **Limpieza Selectiva**: Eliminación proactiva de ruido (`script`, `style`, `noscript`, `iframe`, `nav`, `footer`).
- **Heurística de Ruido**: Penalización de nodos con clases/IDs relacionados con publicidad, menús o Sidebars (`NEGATIVE_PATTERN`).

### 3. Inteligencia de Extracción (**O-ZEN Engine**)
- **Densidad de Texto**: Cálculo de relevancia basado en `word_count / (link_density + 1)`.
- **Bonificación Semántica**: Priorización de etiquetas `<article>` y `<main>`, así como atributos con términos clave (`POSITIVE_PATTERN`).
- **Cascada de Fallback**: Si no se identifica un contenedor principal claro, el sistema retrocede al `<body>` o utiliza el nodo con mayor puntuación acumulada.

### 4. Extracción de Metadatos
- **Semántica**: Soporte completo para OpenGraph, Twitter Cards y JSON-LD.
- **Heurística**: Fallback a selectores CSS comunes para autores y fechas.

### 5. Refinamiento y Salida
- **Conversión a Markdown**: Generación de texto estructurado preservando jerarquía de títulos y listas.
- **Deduplicación**: Sistema de caché de fragmentos para eliminar elementos repetitivos (footers residuales, avisos de cookies).

## 🎨 Integración en la Interfaz

- **Reader Mode (Modo Lectura)**: Nueva vista `/extract?url=...` con diseño premium centrado en la legibilidad.
- **Badges de Resultados**: Acceso directo desde la página de resultados de búsqueda.
- **Preview Integration**: Botón de "Modo Lectura" integrado en el panel lateral de previsualización.

## 🚀 Próximos Pasos (Opcional)
- Implementación de `SimHash` para deduplicación masiva a nivel de base de datos.
- Integración con modelos de lenguaje locales (SLM) para resúmenes automáticos.
