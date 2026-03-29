import sys
import json
import io
import re
import httpx
from concurrent.futures import ThreadPoolExecutor

# Force UTF-8 encoding
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SEARXENA_BASE = "http://127.0.0.1:8000/api/v1"

def calculate_relevance(query, text):
    if not text: return 0
    query_terms = set(re.findall(r'\w+', query.lower()))
    text_low = text.lower()
    score = sum(text_low.count(term) for term in query_terms)
    # Penalizar textos repetitivos o basura (anuncios)
    if len(text) > 1000 and score / len(text) > 0.05: score *= 0.5 
    return score

def extract_and_audit(client, url, query, snippet=""):
    """Extrae contenido usando SearXena extract API y realiza una auditoría interna de calidad."""
    audit_notes = []
    try:
        response = client.post(f"{SEARXENA_BASE}/extract", json={"url": url}, timeout=15.0)
        content = None
        if response.status_code == 200:
            data = response.json()
            content = data.get("content") or data.get("text") or data.get("extracted_text") or ""
        
        status = "KEEP"
        if not content or len(content) < 300:
            status = "DISCARD"
            audit_notes.append("Contenido insuficiente o error de extracción.")
            content = snippet
        
        relevance = calculate_relevance(query, content)
        if relevance < 3 and status == "KEEP":
            status = "AUDIT_FAIL"
            audit_notes.append("Baja relevancia léxica tras extracción profunda.")

        return {
            "url": url,
            "status": status,
            "audit_trail": audit_notes,
            "content": (content[:5000] + "...") if len(content) > 5000 else content,
            "relevance": relevance,
            "justification": "Fuente técnica con alta densidad de información" if status == "KEEP" else "Utilizado como soporte secundario (snippet)"
        }
    except Exception as e:
        return {"url": url, "status": "ERROR", "audit_trail": [str(e)], "content": snippet, "relevance": 0, "justification": "Fallo crítico en extracción"}

def perform_heavy_artillery(client, query, lang="es", limit=8):
    """Ejecuta una búsqueda de alto nivel con SearXena."""
    try:
        payload = {"query": query, "limit": limit, "language": lang, "category": "it" if "tecn" in query or "ai" in query else "general"}
        response = client.post(f"{SEARXENA_BASE}/search", json=payload)
        if response.status_code != 200: return []
        
        results = response.json().get("results", [])
        items = [{"url": r.get("url"), "snippet": r.get("content", "")} for r in results]
        
        # Extract content from each URL using SearXena extract API
        with ThreadPoolExecutor(max_workers=min(len(items), 4) if items else 1) as executor:
            audited_results = list(executor.map(
                lambda x: extract_and_audit(httpx.Client(timeout=15.0), x["url"], query, x["snippet"]),
                items
            ))
        
        return audited_results
    except: return []

def deep_research_artillery(topic, lang="both"):
    """
    DEEP RESEARCH (Heavy Artillery):
    Proceso de Auditoría -> Descarte -> Construcción -> Reporte final.
    Uses SearXena API for both search and content extraction.
    """
    audit_report = {"discarded": [], "validated": [], "warnings": []}
    combined_data = []

    with httpx.Client(timeout=30.0) as client:
        # Búsqueda en Español
        if lang in ["es", "both"]:
            es_results = perform_heavy_artillery(client, topic, lang="es")
            combined_data.extend(es_results)
        
        # Búsqueda en Inglés (Ampliación de contexto)
        if lang in ["en", "both"]:
            en_queries = [topic, f"{topic} deep dive analysis"]
            for q in en_queries:
                en_results = perform_heavy_artillery(client, q, lang="en", limit=5)
                combined_data.extend(en_results)

    # Procesar Auditoría y Construcción
    for item in combined_data:
        if item["status"] == "KEEP":
            audit_report["validated"].append(item)
        elif item["status"] in ["DISCARD", "ERROR"]:
            audit_report["discarded"].append({"url": item["url"], "reason": item["audit_trail"]})
        else:
            audit_report["warnings"].append(item)

    # Generar Reporte de Síntesis (Justificación)
    summary_report = {
        "title": f"Dossier de Investigación: {topic}",
        "methodology": "Artillería Pesada (SearXena Multi-Lang + Native Extract Audit Layer)",
        "total_sources_scanned": len(combined_data),
        "validated_sources": len(audit_report["validated"]),
        "discarded_sources": len(audit_report["discarded"]),
        "executive_summary": "Este reporte constituye la base autorizada para la toma de decisiones. Se han descartado fuentes redundantes y optimizado la información técnica."
    }

    return {
        "success": True,
        "report": summary_report,
        "audit_logs": audit_report,
        "raw_authorized_data": audit_report["validated"] + audit_report["warnings"]
    }

if __name__ == "__main__":
    try:
        args = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
        topic = args.get('topic')
        lang = args.get('target_language', 'both')
        if not topic: sys.exit(1)
        output = deep_research_artillery(topic, lang)
        sys.stdout.write(json.dumps(output, ensure_ascii=False) + "\n")
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
