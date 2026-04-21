import sys
import json
import os
import uuid
import io
from datetime import datetime, timezone
import difflib
import re

# Force UTF-8 output
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def get_workspace_root():
    """
    Priority 1: Environment variable (passed by the Electron app).
    Priority 2: Relative path (dev environment fallback).
    """
    env_root = os.environ.get("MIKU_WORKSPACE_ROOT")
    if env_root and os.path.exists(env_root):
        return os.path.abspath(env_root)

    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(current_dir, "../../../../"))

MEMORY_ROOT = os.path.join(get_workspace_root(), "memory")
INDEX_PATH  = os.path.join(MEMORY_ROOT, "index.json")

# ─────────────────────────────────────────────────────────────────────────────
# SEMANTIC MEMORY TREE  v2
#
# Design principles:
#   • Does NOT duplicate what SOUL.md / USER.md / IDENTITY.md already store
#     (assistant persona, user name/language/level/custom rules).
#   • Covers dynamic, evolving, experiential knowledge the agent accumulates.
#   • Each "leaf" that is a list gets a physical sub-folder.
#   • Each "leaf" that is {} gets only a parent folder (no sub-folders).
#
# Categories:
#   UserContext   — evolving personal facts BEYOND the static USER.md snapshot
#   People        — everyone in the user's life
#   Emotions      — companion-grade emotional intelligence data
#   Beliefs       — values, opinions, worldview, spirituality
#   Learning      — what the user is actively studying or wants to learn
#   Projects      — work/creative/side efforts
#   Agent         — Assistant's own evolution, logic, and self-reflection
#   User          — Subjective, emotional, social, and personal data
#   Universe      — Objective knowledge, projects, places, and external world
# ─────────────────────────────────────────────────────────────────────────────
MEMORY_TREE = {
    # ── MIKU: Self_Model (Internal architecture, operations, and growth) ────────
    "Self_Model": {
        "Cognitive_Growth": {
            "Lessons_Learned":       [],
            "Successful_Strategies": [],
            "Self_Assessments":      [],
            "Feedback_Applied":      [],
            "Knowledge_Gaps":        [],
        },
        "Behavioral_Adaptation": {
            "Communication_Patterns": [],
            "Workflow_Preferences":   [],
            "Pet_Peeves":             [],
        }
    },

    # ── ARMANDO: User_Model (The comprehensive mental model of the user) ──────────
    "User_Model": {
        "Psychographics": {
            "Identity_Bio":          [],
            "Core_Values":           [],
            "Beliefs_Worldview":     [],
            "Preferences":           [],
            "Goals_Fears":           [],
        },
        "Biopsychosocial_State": {
            "Health_Physical":       [],
            "Mental_Emotional":      [],
            "Routines_Habits":       [],
            "Support_Needs":         [],
        },
        "Active_Context": {
            "Projects":              [],
            "Learning_Path":         [],
            "Hobbies_Interests":     [],
            "Entertainment":         [],
            "Daily_Life_Finance":    [],
        },
        "Social_Graph": {
            "Family":                [],
            "Friends":               [],
            "Romantic":              [],
            "Professional":          [],
            "Pets":                  [],
        }
    },

    # ── THE WORLD: Semantic_Memory (Curated factual knowledge base) ──────────────
    "Semantic_Memory": {
        "Technical_Concepts": {
            "Programming":           [],
            "DevOps_Infra":          [],
            "AI_ML":                 [],
            "Design_Architecture":   [],
        },
        "World_Context": {
            "News_Events":           [],
            "Cultural_Trends":       [],
            "History_Science":       [],
        },
        "Spatial_Data": {
            "Places_Lived":          [],
            "Places_Visited":        [],
            "Wishlist":              [],
        }
    }
}



# ─────────────────────────────────────────────────────────────────────────────
# SEMANTIC GRAPH  (stored INSIDE index.json)
#
# Each memory in the index has an optional "links" list:
#   { "to": "mem_xxxxxxxx", "relation": "influences|caused_by|same_topic|contradicts|expands" }
#
# This makes the graph BIDIRECTIONAL and TYPED — far richer than tag overlap alone.
# ─────────────────────────────────────────────────────────────────────────────
VALID_RELATIONS = {
    "influences",    # This memory influences / shapes the other
    "caused_by",     # This memory was caused by / originated from the other
    "same_topic",    # Same subject, different angle
    "contradicts",   # These memories are in tension
    "expands",       # This memory deepens / adds to the other
    "related_to",    # Generic semantic proximity
}


# ─────────────────────────────────────────────────────────────────────────────
# INDEX HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def load_index():
    if not os.path.exists(INDEX_PATH):
        return {"memories": {}, "graph": {}}
    try:
        with open(INDEX_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # Backwards compat: ensure graph key exists
            if "graph" not in data:
                data["graph"] = {}
            return data
    except Exception:
        return {"memories": {}, "graph": {}}

def save_index(index_data):
    os.makedirs(os.path.dirname(INDEX_PATH), exist_ok=True)
    with open(INDEX_PATH, 'w', encoding='utf-8') as f:
        json.dump(index_data, f, indent=4, ensure_ascii=False)


# ─────────────────────────────────────────────────────────────────────────────
# TEXT UTILITIES
# ─────────────────────────────────────────────────────────────────────────────
def _clean_text(text):
    return re.sub(r'\s+', ' ', str(text)).strip().lower()

def _age_label(ts_str, stale_days=90):
    """Returns {'age': str, 'days': int, 'stale': bool}"""
    if not ts_str:
        return {"age": "unknown", "days": -1, "stale": False}
    try:
        ts_clean = ts_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(ts_clean)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        delta = datetime.now(timezone.utc) - dt
        d = delta.days
        if d == 0:
            h = delta.seconds // 3600
            label = f"{h}h ago" if h > 0 else "just now"
        elif d == 1:
            label = "1 day ago"
        elif d < 30:
            label = f"{d} days ago"
        elif d < 365:
            m = d // 30
            label = f"{m} month{'s' if m > 1 else ''} ago"
        else:
            y = d // 365
            label = f"{y} year{'s' if y > 1 else ''} ago"
        return {"age": label, "days": d, "stale": d >= stale_days}
    except Exception:
        return {"age": "unknown", "days": -1, "stale": False}

STOP_WORDS = {
    "the","a","an","is","are","was","were","be","been","being","have","has","had",
    "do","does","did","will","would","could","should","may","might","shall","can",
    "to","of","in","for","on","with","at","by","from","as","into","through",
    "before","after","and","but","or","nor","not","no","so","very","just","also",
    "than","that","this","it","its","i","they","them","their","we","our","you",
    "el","la","los","las","un","una","de","en","con","por","para","es","son",
    "que","del","al","se","su","sus","y","o","si","lo","le","me","mi","mis",
    "nos","pero","como","sin","sobre","entre","ya","hay","ser","estar","tiene",
}

def _keywords(text):
    return set(re.findall(r'\w+', _clean_text(text))) - STOP_WORDS

def _jaccard(a, b):
    return len(a & b) / len(a | b) if (a and b and (a | b)) else 0.0

def _score_memory(mem, query_clean, query_words, query_kw):
    """
    Multi-signal relevance scoring:
      +5  full query is a substring of the combined searchable text
      +1  per matching query word in searchable text
      +3  per tag that appears in the query
      +4  Jaccard keyword similarity ≥ 0.4 (scaled 0→4 based on ratio)
    """
    searchable = " ".join([
        mem.get("category", ""),
        mem.get("subcategory", ""),
        " ".join(mem.get("tags", [])),
        mem.get("preview_text", ""),
    ])
    sc = _clean_text(searchable)
    score = 0
    if query_clean in sc:
        score += 5
    for w in query_words:
        if w in sc:
            score += 1
    for tag in mem.get("tags", []):
        if tag.lower() in query_clean:
            score += 3
    mem_kw = _keywords(mem.get("preview_text", ""))
    jac = _jaccard(query_kw, mem_kw)
    if jac >= 0.4:
        score += int(jac * 4)
    return score


# ─────────────────────────────────────────────────────────────────────────────
# REDUNDANCY CHECK  (two-pass: sequence + Jaccard keyword)
# ─────────────────────────────────────────────────────────────────────────────
def is_redundant(new_data, index_data, seq_thr=0.80, kw_thr=0.68):
    clean_new = _clean_text(new_data)
    kw_new    = _keywords(new_data)
    if not clean_new:
        return False, None
    for mem in index_data.get("memories", {}).values():
        clean_old = _clean_text(mem.get("preview_text", ""))
        if not clean_old:
            continue
        if difflib.SequenceMatcher(None, clean_new, clean_old).ratio() >= seq_thr:
            return True, mem
        kw_old = _keywords(mem.get("preview_text", ""))
        if _jaccard(kw_new, kw_old) >= kw_thr:
            return True, mem
    return False, None


# ─────────────────────────────────────────────────────────────────────────────
# GRAPH HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def _add_link(index_data, from_id, to_id, relation):
    """Add a TYPED, BIDIRECTIONAL edge to the semantic graph."""
    relation = relation if relation in VALID_RELATIONS else "related_to"
    graph = index_data.setdefault("graph", {})

    # Forward edge
    edges = graph.setdefault(from_id, [])
    if not any(e["to"] == to_id and e["relation"] == relation for e in edges):
        edges.append({"to": to_id, "relation": relation})

    # Backward edge (inverse)
    INVERSE = {
        "influences": "related_to",
        "caused_by":  "influences",
        "same_topic": "same_topic",
        "contradicts":"contradicts",
        "expands":    "related_to",
        "related_to": "related_to",
    }
    b_edges = graph.setdefault(to_id, [])
    inv_rel = INVERSE.get(relation, "related_to")
    if not any(e["to"] == from_id and e["relation"] == inv_rel for e in b_edges):
        b_edges.append({"to": from_id, "relation": inv_rel})

def _get_graph_neighbors(index_data, mem_id, depth=2):
    """
    BFS traversal of the semantic graph starting from mem_id.
    Returns list of {id, relation, depth, preview_text, age} dicts.
    Returns at most 10 connected nodes across up to `depth` hops.
    """
    graph    = index_data.get("graph", {})
    memories = index_data.get("memories", {})
    visited  = {mem_id}
    queue    = [(mem_id, 0)]
    neighbors = []

    while queue and len(neighbors) < 10:
        current_id, current_depth = queue.pop(0)
        if current_depth >= depth:
            continue
        for edge in graph.get(current_id, []):
            nid = edge["to"]
            if nid in visited:
                continue
            visited.add(nid)
            mem = memories.get(nid)
            if not mem:
                continue
            ref_ts = mem.get("updated") or mem.get("created", "")
            age_info = _age_label(ref_ts)
            neighbors.append({
                "id":           nid,
                "relation":     edge["relation"],
                "depth":        current_depth + 1,
                "category":     mem.get("category", ""),
                "subcategory":  mem.get("subcategory", ""),
                "tags":         mem.get("tags", []),
                "preview_text": mem.get("preview_text", "")[:200],
                "age":          age_info["age"],
                "stale":        age_info["stale"],
            })
            queue.append((nid, current_depth + 1))

    return neighbors


# ─────────────────────────────────────────────────────────────────────────────
# FOLDER TREE BUILDER
# ─────────────────────────────────────────────────────────────────────────────
def _build_tree_on_disk(base, tree):
    for key, children in tree.items():
        folder = os.path.join(base, key)
        os.makedirs(folder, exist_ok=True)
        if isinstance(children, dict):
            _build_tree_on_disk(folder, children)
        elif isinstance(children, list):
            for child in children:
                os.makedirs(os.path.join(folder, child), exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# COMMAND: init
# ─────────────────────────────────────────────────────────────────────────────
def command_init():
    os.makedirs(MEMORY_ROOT, exist_ok=True)
    _build_tree_on_disk(MEMORY_ROOT, MEMORY_TREE)
    if not os.path.exists(INDEX_PATH):
        save_index({"memories": {}, "graph": {}})
    return {
        "success": True,
        "message": "Memory semantic tree deployed.",
        "path": MEMORY_ROOT,
        "categories": list(MEMORY_TREE.keys()),
        "hint": (
            "Commands: synapse (create), recall (search+graph), "
            "refresh (update), amnesia (delete), nexus (overview), link (connect)."
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# COMMAND: synapse  — create a memory + optional explicit links
# ─────────────────────────────────────────────────────────────────────────────
def command_synapse(category, subcategory, data, tags, linked_to=None):
    """
    linked_to: list of {"id": "mem_xxx", "relation": "expands|same_topic|..."}.
    """
    if not data:
        return {"success": False, "error": "No content provided."}
    category    = category    or "Knowledge"
    subcategory = subcategory or "Facts_Trivia"
    tags        = tags        or []
    linked_to   = linked_to  or []

    os.makedirs(MEMORY_ROOT, exist_ok=True)
    index_data = load_index()

    redundant, existing = is_redundant(data, index_data)
    if redundant:
        return {
            "success": False,
            "error": "Memory is redundant with an existing entry.",
            "existing_id": existing.get("id"),
            "existing_preview": existing.get("preview_text", "")[:200],
            "suggestion": "Use 'refresh' to update it, or add distinct details.",
        }

    # Validate linked_to targets exist
    valid_links = []
    missing_links = []
    for link in linked_to:
        lid = link.get("id", "")
        if lid in index_data.get("memories", {}):
            valid_links.append({"id": lid, "relation": link.get("relation", "related_to")})
        else:
            missing_links.append(lid)

    mem_id   = f"mem_{uuid.uuid4().hex[:8]}"
    ts       = datetime.now(timezone.utc).isoformat()
    target   = os.path.join(MEMORY_ROOT, category, subcategory)
    os.makedirs(target, exist_ok=True)

    filename  = f"{mem_id}.md"
    filepath  = os.path.join(target, filename)
    rel_path  = os.path.join(category, subcategory, filename).replace("\\", "/")

    # Build links block for frontmatter
    link_lines = ""
    if valid_links:
        link_lines = "links:\n"
        for lnk in valid_links:
            link_lines += f"  - {{ id: \"{lnk['id']}\", relation: \"{lnk['relation']}\" }}\n"

    md  = "---\n"
    md += f"id: {mem_id}\n"
    md += f"category: {category}\n"
    md += f"subcategory: {subcategory}\n"
    md += f"tags: {json.dumps(tags)}\n"
    md += f"created: {ts}\n"
    md += f"updated: {ts}\n"
    if link_lines:
        md += link_lines
    md += "---\n\n"
    md += f"{data}\n"

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(md)

    preview = _clean_text(data)[:600]
    index_data["memories"][mem_id] = {
        "id":           mem_id,
        "category":     category,
        "subcategory":  subcategory,
        "tags":         tags,
        "created":      ts,
        "updated":      ts,
        "filepath":     rel_path,
        "preview_text": preview,
    }

    # Register edges in graph
    for lnk in valid_links:
        _add_link(index_data, mem_id, lnk["id"], lnk["relation"])

    save_index(index_data)

    result = {
        "success":    True,
        "message":    f"Memory '{mem_id}' stored.",
        "memory_id":  mem_id,
        "filepath":   rel_path,
        "tags":       tags,
        "links_created": [l["id"] for l in valid_links],
    }
    if missing_links:
        result["warnings"] = [f"Linked ID not found: {lid}" for lid in missing_links]
    return result


# ─────────────────────────────────────────────────────────────────────────────
# COMMAND: recall  — search + semantic graph traversal
# ─────────────────────────────────────────────────────────────────────────────
def command_recall(query, depth=2):
    if not query:
        return {"success": False, "error": "Query is required."}

    index_data   = load_index()
    query_clean  = _clean_text(query)
    query_words  = set(query_clean.split()) - STOP_WORDS
    query_kw     = _keywords(query)

    scored = []
    for mem in index_data.get("memories", {}).values():
        s = _score_memory(mem, query_clean, query_words, query_kw)
        if s > 0:
            scored.append((s, mem))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = [r[1] for r in scored[:5]]

    if not top:
        return {
            "success": True, 
            "message": "No memories found.", 
            "results": [], 
            "graph_neighbors": [],
            "debug_path": INDEX_PATH
        }

    # Enrich results
    enriched = []
    for mem in top:
        entry = mem.copy()
        ref_ts = mem.get("updated") or mem.get("created", "")
        age_info = _age_label(ref_ts)
        entry["created_at"] = mem.get("created", "")
        entry["updated_at"] = mem.get("updated", mem.get("created", ""))
        entry["age"]        = age_info["age"]
        entry["stale"]      = age_info["stale"]
        if age_info["stale"]:
            entry["stale_warning"] = (
                f"⚠️ Memory is {age_info['age']} old. "
                "Consider refreshing with the 'refresh' command."
            )
        try:
            with open(os.path.join(MEMORY_ROOT, mem["filepath"]), 'r', encoding='utf-8') as f:
                entry["full_content"] = f.read()
        except Exception:
            entry["full_content"] = "[Error reading file]"
        enriched.append(entry)

    # LAYER 1 — Tag-overlap connections (fast surface-level)
    all_tags = set()
    for mem in top:
        all_tags.update(t.lower() for t in mem.get("tags", []))
    top_ids = {m["id"] for m in top}

    tag_connections = []
    for mem in index_data.get("memories", {}).values():
        if mem["id"] in top_ids:
            continue
        overlap = all_tags & {t.lower() for t in mem.get("tags", [])}
        if overlap:
            ref_ts = mem.get("updated") or mem.get("created", "")
            ai = _age_label(ref_ts)
            tag_connections.append({
                "id":           mem["id"],
                "category":     mem["category"],
                "subcategory":  mem["subcategory"],
                "shared_tags":  list(overlap),
                "preview_text": mem.get("preview_text", "")[:200],
                "age":          ai["age"],
                "stale":        ai["stale"],
                "connection_type": "tag_overlap",
            })
    tag_connections.sort(key=lambda x: len(x["shared_tags"]), reverse=True)

    # LAYER 2 — Explicit semantic graph traversal (typed edges, multi-hop)
    graph_neighbors = []
    seen_graph_ids = {*top_ids}
    for mem in top:
        for neighbor in _get_graph_neighbors(index_data, mem["id"], depth=depth):
            if neighbor["id"] not in seen_graph_ids:
                seen_graph_ids.add(neighbor["id"])
                neighbor["connection_type"] = "semantic_graph"
                graph_neighbors.append(neighbor)

    all_connections = graph_neighbors + [t for t in tag_connections if t["id"] not in seen_graph_ids]

    return {
        "success":           True,
        "results":           enriched,
        "related_memories":  all_connections[:8],
        "graph_depth_used":  depth,
    }


# ─────────────────────────────────────────────────────────────────────────────
# COMMAND: link  — create/add explicit semantic edges between existing memories
# ─────────────────────────────────────────────────────────────────────────────
def command_link(from_id, to_id, relation):
    if not from_id or not to_id:
        return {"success": False, "error": "Both 'from_id' and 'to_id' are required."}
    relation = relation or "related_to"
    index_data = load_index()
    memories   = index_data.get("memories", {})

    if from_id not in memories:
        return {"success": False, "error": f"Memory '{from_id}' not found."}
    if to_id not in memories:
        return {"success": False, "error": f"Memory '{to_id}' not found."}
    if relation not in VALID_RELATIONS:
        return {
            "success": False,
            "error": f"Invalid relation. Valid: {sorted(VALID_RELATIONS)}",
        }

    _add_link(index_data, from_id, to_id, relation)
    save_index(index_data)

    return {
        "success":  True,
        "message":  f"Semantic link created: {from_id} ──[{relation}]──► {to_id}",
        "from_id":  from_id,
        "relation": relation,
        "to_id":    to_id,
    }


# ─────────────────────────────────────────────────────────────────────────────
# COMMAND: refresh  — update content of existing memory
# ─────────────────────────────────────────────────────────────────────────────
def command_refresh(query, data, tags=None):
    if not query:
        return {"success": False, "error": "Provide memory ID or search query."}
    if not data:
        return {"success": False, "error": "Provide new 'data' content."}

    index_data = load_index()
    target_id = None

    if query in index_data.get("memories", {}):
        target_id = query
    else:
        res = command_recall(query)
        if res.get("results"):
            target_id = res["results"][0]["id"]

    if not target_id or target_id not in index_data["memories"]:
        return {"success": False, "error": "Memory not found."}

    mem      = index_data["memories"][target_id]
    filepath = os.path.join(MEMORY_ROOT, mem["filepath"])
    now      = datetime.now(timezone.utc).isoformat()
    new_tags = tags if tags is not None else mem.get("tags", [])

    # Rebuild links block from graph
    edges     = index_data.get("graph", {}).get(target_id, [])
    link_lines = ""
    if edges:
        link_lines = "links:\n"
        for e in edges:
            link_lines += f"  - {{ id: \"{e['to']}\", relation: \"{e['relation']}\" }}\n"

    md  = "---\n"
    md += f"id: {target_id}\n"
    md += f"category: {mem['category']}\n"
    md += f"subcategory: {mem['subcategory']}\n"
    md += f"tags: {json.dumps(new_tags)}\n"
    md += f"created: {mem.get('created', now)}\n"
    md += f"updated: {now}\n"
    if link_lines:
        md += link_lines
    md += "---\n\n"
    md += f"{data}\n"

    try:
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(md)
    except Exception as e:
        return {"success": False, "error": str(e)}

    mem["updated"]      = now
    mem["tags"]         = new_tags
    mem["preview_text"] = _clean_text(data)[:600]
    save_index(index_data)

    return {
        "success":    True,
        "message":    f"Memory '{target_id}' refreshed.",
        "memory_id":  target_id,
        "updated_at": now,
    }


# ─────────────────────────────────────────────────────────────────────────────
# COMMAND: amnesia  — delete a memory and clean its graph edges
# ─────────────────────────────────────────────────────────────────────────────
def command_amnesia(query):
    if not query:
        return {"success": False, "error": "Provide memory ID or search query."}

    index_data = load_index()
    target_id  = None

    if query in index_data.get("memories", {}):
        target_id = query
    else:
        res = command_recall(query)
        if res.get("results"):
            target_id = res["results"][0]["id"]

    if not target_id or target_id not in index_data["memories"]:
        return {"success": False, "error": "Memory not found."}

    mem = index_data["memories"][target_id]
    try:
        fp = os.path.join(MEMORY_ROOT, mem["filepath"])
        if os.path.exists(fp):
            os.remove(fp)
    except Exception as e:
        return {"success": False, "error": str(e)}

    del index_data["memories"][target_id]

    # Clean graph: remove all edges involving this id
    graph = index_data.get("graph", {})
    graph.pop(target_id, None)
    for edges in graph.values():
        edges[:] = [e for e in edges if e["to"] != target_id]

    save_index(index_data)
    return {"success": True, "message": f"Memory '{target_id}' and its graph edges removed."}


# ─────────────────────────────────────────────────────────────────────────────
# COMMAND: nexus  — full semantic overview map
# ─────────────────────────────────────────────────────────────────────────────
def command_nexus():
    index_data = load_index()
    tree  = {}
    total = 0
    stale = 0
    graph = index_data.get("graph", {})
    total_edges = sum(len(v) for v in graph.values()) // 2  # bidirectional, so halve

    for mem in index_data.get("memories", {}).values():
        cat    = mem.get("category", "Uncategorized")
        subcat = mem.get("subcategory", "General")
        ref_ts = mem.get("updated") or mem.get("created", "")
        ai     = _age_label(ref_ts)
        if ai["stale"]:
            stale += 1
        edges  = graph.get(mem["id"], [])
        tree.setdefault(cat, {}).setdefault(subcat, []).append({
            "id":       mem["id"],
            "tags":     mem.get("tags", []),
            "created":  mem.get("created", ""),
            "updated":  mem.get("updated", ""),
            "age":      ai["age"],
            "stale":    ai["stale"],
            "links":    len(edges),
            "preview":  mem.get("preview_text", "")[:120],
        })
        total += 1

    return {
        "success":          True,
        "total_memories":   total,
        "stale_memories":   stale,
        "semantic_edges":   total_edges,
        "tree":             tree,
    }


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────
def main():
    try:
        args    = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
        command = args.get("command")

        # Auto-bootstrap: if the index doesn't exist, initialize the full tree
        # automatically — but flag it in the response so the user is informed.
        auto_initialized = False
        if not os.path.exists(INDEX_PATH) and command != "init":
            command_init()
            auto_initialized = True

        if command == "init":
            output = command_init()
        elif command == "synapse":
            output = command_synapse(
                category   = args.get("category"),
                subcategory= args.get("subcategory"),
                data       = args.get("data"),
                tags       = args.get("tags"),
                linked_to  = args.get("linked_to"),
            )
        elif command == "recall":
            output = command_recall(
                query = args.get("query"),
                depth = args.get("depth", 2),
            )
        elif command == "refresh":
            output = command_refresh(
                query = args.get("query"),
                data  = args.get("data"),
                tags  = args.get("tags"),
            )
        elif command == "amnesia":
            output = command_amnesia(query=args.get("query"))
        elif command == "link":
            output = command_link(
                from_id  = args.get("from_id"),
                to_id    = args.get("to_id"),
                relation = args.get("relation", "related_to"),
            )
        elif command == "nexus":
            output = command_nexus()
        else:
            output = {
                "success":  False,
                "error":    f"Unknown command: '{command}'",
                "valid":    ["init","synapse","recall","refresh","amnesia","link","nexus"],
            }

        # If the system bootstrapped itself, let the user know
        if auto_initialized and isinstance(output, dict):
            output["auto_initialized"] = True
            output["init_notice"] = (
                "🧠 The memory system was not set up yet — the full folder tree and index "
                "were created automatically. You can also run 'init' explicitly at any time "
                "to reset or redeploy the memory structure."
            )

        print(json.dumps(output, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
