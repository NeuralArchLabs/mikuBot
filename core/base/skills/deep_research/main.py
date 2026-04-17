import sys
import json
import io
import re
import requests
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

def extract_and_audit(url, query, snippet=""):
    """Extrae contenido usando SearXena extract API y realiza una auditoría interna de calidad."""
    audit_notes = []
    try:
        response = requests.post(f"{SEARXENA_BASE}/extract", json={"url": url}, timeout=15.0)
        content = None
        if response.status_code == 200:
            data = response.json()
            content = data.get("content") or data.get("text") or data.get("extracted_text") or ""
        
        status = "KEEP"
        if not content or len(content) < 300:
            status = "DISCARD"
            audit_notes.append("Insufficient content or extraction error.")
            content = snippet
        
        relevance = calculate_relevance(query, content)
        if relevance < 3 and status == "KEEP":
            status = "AUDIT_FAIL"
            audit_notes.append("Low lexical relevance after deep extraction.")

        return {
            "url": url,
            "status": status,
            "audit_trail": audit_notes,
            "content": (content[:5000] + "...") if len(content) > 5000 else content,
            "relevance": relevance,
            "justification": "Technical source with high information density" if status == "KEEP" else "Used as secondary support (snippet)"
        }
    except Exception as e:
        return {"url": url, "status": "ERROR", "audit_trail": [str(e)], "content": snippet, "relevance": 0, "justification": "Critical extraction failure"}

def perform_heavy_artillery(query, lang="es", limit=8, categories=None):
    """Ejecuta una búsqueda de alto nivel con SearXena en múltiples categorías."""
    if not categories: categories = ["general"]
    
    total_results = []
    seen_urls = set()

    for cat in categories:
        try:
            payload = {"query": query, "limit": limit, "language": lang, "category": cat}
            response = requests.post(f"{SEARXENA_BASE}/search", json=payload, timeout=20.0)
            if response.status_code == 200:
                results = response.json().get("results", [])
                for r in results:
                    url = r.get("url")
                    if url and url not in seen_urls:
                        seen_urls.add(url)
                        total_results.append({"url": url, "snippet": r.get("content", ""), "category": cat})
        except: continue
    
    if not total_results: return []

    # Extract content using SearXena extract API
    # Usamos ThreadPool para paralelizar extracciones (mismo host, SearXena lo maneja)
    with ThreadPoolExecutor(max_workers=min(len(total_results), 5)) as executor:
        audited_results = list(executor.map(
            lambda x: {**extract_and_audit(x["url"], query, x["snippet"]), "category": x["category"]},
            total_results
        ))
    
    return audited_results

def deep_research_artillery(topic, lang="both", categories=None):
    """
    DEEP RESEARCH (Heavy Artillery):
    Proceso de Auditoría -> Descarte -> Construcción -> Reporte final.
    Explora múltiples categorías de SearXena para una cobertura total.
    """
    if not categories: categories = ["general"]
    audit_report = {"discarded": [], "validated": [], "warnings": []}
    combined_data = []

    try:
        # Búsqueda en Español
        if lang in ["es", "both"]:
            es_results = perform_heavy_artillery(topic, lang="es", limit=5, categories=categories)
            combined_data.extend(es_results)
        
        # Búsqueda en Inglés (Ampliación de contexto técnico)
        if lang in ["en", "both"]:
            en_queries = [topic, f"{topic} technical documentation"]
            for q in en_queries:
                en_results = perform_heavy_artillery(q, lang="en", limit=4, categories=categories)
                combined_data.extend(en_results)

        # Procesar Auditoría y Construcción
        # Usamos un set para evitar URLs duplicadas entre búsquedas/categorías
        seen_urls = set()
        for item in combined_data:
            if item["url"] in seen_urls: continue
            seen_urls.add(item["url"])

            if item["status"] == "KEEP":
                audit_report["validated"].append(item)
            elif item["status"] in ["DISCARD", "ERROR"]:
                audit_report["discarded"].append({"url": item["url"], "reason": item["audit_trail"], "category": item.get("category")})
            else:
                audit_report["warnings"].append(item)

        # Generar Reporte de Síntesis (Justificación)
        summary_report = {
            "title": f"Research Dossier: {topic}",
            "methodology": f"Heavy Artillery (SearXena Multi-Lang + Multi-Category: {', '.join(categories)})",
            "stats": {
                "total_scanned": len(seen_urls),
                "validated": len(audit_report["validated"]),
                "warnings": len(audit_report["warnings"]),
                "discarded": len(audit_report["discarded"])
            },
            "executive_summary": f"Exhaustive report generated by analyzing {len(seen_urls)} sources across categories {', '.join(categories)}."
        }

        return {
            "success": True,
            "report": summary_report,
            "audit_logs": audit_report,
            "raw_authorized_data": audit_report["validated"] + audit_report["warnings"]
        }
    except Exception as e:
        return {"success": False, "error": f"Research engine failure: {str(e)}"}

if __name__ == "__main__":
    try:
        args = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
        topic = args.get('topic')
        lang = args.get('target_language', 'both')
        categories = args.get('categories', ['general'])
        if not topic: sys.exit(1)
        output = deep_research_artillery(topic, lang, categories)
        sys.stdout.write(json.dumps(output, ensure_ascii=False) + "\n")
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
