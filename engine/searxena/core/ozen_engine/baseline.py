"""
Module regrouping baseline and basic extraction functions.
"""
# pylint:disable-msg=E0611

import json
import re
import logging

from typing import Any, Dict, List, Optional, Tuple

from lxml.etree import _Element, Element, SubElement
from lxml.html import HtmlElement

from .settings import BASIC_CLEAN_XPATH
from .utils import load_html, trim
from .xml import delete_element

LOGGER = logging.getLogger(__name__)


def basic_cleaning(tree: HtmlElement) -> HtmlElement:
    "Remove a few section types from the document."
    for elem in BASIC_CLEAN_XPATH(tree):
        delete_element(elem)
    return tree


# ─────────────────────────────────────────────────────────────────────────────
# NATIVE ENHANCEMENT: Extended JSON-LD extraction
# ─────────────────────────────────────────────────────────────────────────────

# Fields that commonly contain article body text in JSON-LD
JSONLD_BODY_FIELDS = {
    "articlebody", "body", "content", "text",
    "description", "headline", "name", "title",
    "abstract", "story", "html",
}


def _walk_jsonld(obj: Any) -> List[str]:
    """Walk a JSON-LD object recursively to find body text fields."""
    results = []
    if isinstance(obj, dict):
        for key, value in obj.items():
            key_lower = key.lower()
            if key_lower in JSONLD_BODY_FIELDS and isinstance(value, str) and len(value) > 100:
                results.append(value)
            elif isinstance(value, (list, dict)):
                results.extend(_walk_jsonld(value))
    elif isinstance(obj, list):
        for item in obj:
            results.extend(_walk_jsonld(item))
    return results


def _extract_liveblog_updates(data: Any) -> Optional[List[str]]:
    """Recursively search for liveBlogUpdate list and extract text from updates."""
    if isinstance(data, dict):
        updates = data.get("liveBlogUpdate")
        if isinstance(updates, list) and updates:
            extracted = []
            for item in updates:
                if isinstance(item, dict):
                    headline = (item.get("headline") or "").strip()
                    body = (item.get("articleBody") or item.get("text") or "").strip()
                    parts = []
                    if headline:
                        parts.append(headline)
                    if body:
                        parts.append(body)
                    if parts:
                        extracted.append("\n".join(parts))
            if extracted:
                return extracted
        
        for v in data.values():
            res = _extract_liveblog_updates(v)
            if res:
                return res
    elif isinstance(data, list):
        for item in data:
            res = _extract_liveblog_updates(item)
            if res:
                return res
    return None


def extract_jsonld_content(filecontent: Any) -> Optional[Dict[str, str]]:
    """
    Extract content from JSON-LD scripts (schema.org, etc.).
    
    Enhanced version that searches recursively for articleBody, body,
    content, text, and other fields in nested JSON structures.
    
    Returns:
        Dict with {content, title, description, image, type} or None
    """
    tree = load_html(filecontent)
    if tree is None:
        return None

    # First pass: search for liveBlogUpdate across all JSON-LD elements
    for elem in tree.iterfind('.//script[@type="application/ld+json"]'):
        if not elem.text:
            continue
        try:
            data = json.loads(elem.text)
        except (json.JSONDecodeError, ValueError):
            continue

        updates = _extract_liveblog_updates(data)
        if updates:
            result = {"content": "\n\n".join(updates), "title": None, "description": None, "image": None, "type": "liveblog"}
            if isinstance(data, dict):
                if isinstance(data.get("headline"), str):
                    result["title"] = data["headline"]
                elif isinstance(data.get("name"), str):
                    result["title"] = data["name"]
                if isinstance(data.get("description"), str):
                    result["description"] = data["description"]
                if isinstance(data.get("image"), str):
                    result["image"] = data["image"]
                elif isinstance(data.get("image"), list) and data["image"]:
                    if isinstance(data["image"][0], str):
                        result["image"] = data["image"][0]
                elif isinstance(data.get("image"), dict) and isinstance(data["image"].get("url"), str):
                    result["image"] = data["image"]["url"]
            return result

    # Second pass: standard recursive content extraction
    for elem in tree.iterfind('.//script[@type="application/ld+json"]'):
        if not elem.text:
            continue
        try:
            data = json.loads(elem.text)
        except (json.JSONDecodeError, ValueError):
            continue

        result = {"content": None, "title": None, "description": None, "image": None, "type": None}
        bodies = _walk_jsonld(data)
        if bodies:
            result["content"] = max(bodies, key=len)

        # Extract metadata
        if isinstance(data, dict):
            if isinstance(data.get("headline"), str):
                result["title"] = data["headline"]
            elif isinstance(data.get("name"), str):
                result["title"] = data["name"]
            if isinstance(data.get("description"), str):
                result["description"] = data["description"]
            if isinstance(data.get("image"), str):
                result["image"] = data["image"]
            elif isinstance(data.get("image"), list) and data["image"]:
                if isinstance(data["image"][0], str):
                    result["image"] = data["image"][0]
            elif isinstance(data.get("image"), dict) and isinstance(data["image"].get("url"), str):
                result["image"] = data["image"]["url"]
            if isinstance(data.get("@type"), str):
                result["type"] = result["type"] or data["@type"]

        if result["content"] and len(result["content"]) > 100:
            return result

    return None


# ─────────────────────────────────────────────────────────────────────────────
# NATIVE ENHANCEMENT: Next.js __NEXT_DATA__ extraction
# ─────────────────────────────────────────────────────────────────────────────

def extract_next_data(filecontent: Any) -> Optional[Dict[str, str]]:
    """
    Extract content from Next.js __NEXT_DATA__ script tag.
    
    Next.js serializes page content in a JSON within
    <script id="__NEXT_DATA__" type="application/json">.
    """
    tree = load_html(filecontent)
    if tree is None:
        return None

    for elem in tree.iterfind('.//script[@id="__NEXT_DATA__"]'):
        if not elem.text:
            continue
        try:
            data = json.loads(elem.text)
        except (json.JSONDecodeError, ValueError):
            continue

        bodies = _walk_jsonld(data)
        if bodies:
            return {
                "content": max(bodies, key=len),
                "title": None,
                "description": None,
                "image": None,
                "type": "next_data"
            }
    return None


# ─────────────────────────────────────────────────────────────────────────────
# NATIVE ENHANCEMENT: <noscript> fallback extraction
# ─────────────────────────────────────────────────────────────────────────────

def extract_noscript_content(filecontent: Any) -> Optional[Dict[str, str]]:
    """
    Extract content from <noscript> tags.
    
    Many SPAs render their content in <noscript> as a fallback
    for crawlers and users without JavaScript.
    """
    tree = load_html(filecontent)
    if tree is None:
        return None

    all_text = []
    for ns in tree.iterfind('.//noscript'):
        text = ns.text_content() if hasattr(ns, 'text_content') else ""
        if text and len(text) > 200:
            all_text.append(text)

    if all_text:
        combined = "\n\n".join(all_text)
        return {
            "content": combined,
            "title": None,
            "description": None,
            "image": None,
            "type": "noscript"
        }
    return None


# ─────────────────────────────────────────────────────────────────────────────
# NATIVE ENHANCEMENT: Extended meta tags extraction
# ─────────────────────────────────────────────────────────────────────────────

META_SELECTORS = [
    ('meta[property="og:title"]', "title"),
    ('meta[name="twitter:title"]', "title"),
    ('meta[itemprop="headline"]', "title"),
    ('meta[property="og:description"]', "description"),
    ('meta[name="twitter:description"]', "description"),
    ('meta[itemprop="description"]', "description"),
    ('meta[name="description"]', "description"),
    ('meta[property="og:image"]', "image"),
    ('meta[name="twitter:image"]', "image"),
    ('meta[itemprop="image"]', "image"),
    ('meta[property="og:site_name"]', "site_name"),
    ('meta[property="og:url"]', "url"),
]


def extract_extended_meta(filecontent: Any) -> Optional[Dict[str, str]]:
    """
    Extract metadata from OpenGraph, Twitter Cards, and schema.org meta tags.
    """
    tree = load_html(filecontent)
    if tree is None:
        return None

    result = {"title": None, "description": None, "image": None, "site_name": None, "url": None}

    for selector, field in META_SELECTORS:
        if result.get(field):
            continue  # Already found
        elements = tree.cssselect(selector)
        for elem in elements:
            attr = elem.get("content") or elem.get("value")
            if attr:
                result[field] = attr
                break

    if result["title"] or result["description"]:
        return result
    return None


# ─────────────────────────────────────────────────────────────────────────────
# NATIVE ENHANCEMENT: Heuristic density extraction
# ─────────────────────────────────────────────────────────────────────────────

def extract_heuristic_density(filecontent: Any) -> Optional[Dict[str, str]]:
    """
    Find the container with the highest text density as a last resort.
    """
    tree = load_html(filecontent)
    if tree is None:
        return None

    candidates = []
    for css in ['article', 'main', '[role="main"]', 'div[class*="content"]', 'div[class*="post"]']:
        try:
            candidates.extend(tree.cssselect(css))
        except Exception:
            pass

    best, best_len = None, 0
    for c in candidates:
        try:
            text = c.text_content()
        except Exception:
            continue
        if text and len(text) > best_len:
            best, best_len = text, len(text)

    if best and len(best) > 200:
        return {"content": best, "title": None, "description": None, "image": None, "type": "heuristic"}
    return None


# ─────────────────────────────────────────────────────────────────────────────
# MAIN: Enhanced baseline with native strategies
# ─────────────────────────────────────────────────────────────────────────────

def baseline(filecontent: Any) -> Tuple[_Element, str, int]:
    """Use baseline extraction function targeting text paragraphs and/or JSON metadata.

    Enhanced with native strategies for dynamic sites:
    1. JSON-LD (schema.org articleBody, recursive search)
    2. __NEXT_DATA__ (Next.js)
    3. <noscript> fallback (SPAs)
    4. Extended meta tags (OpenGraph, Twitter)
    5. Heuristic density (last resort)
    6. Original baseline (paragraphs, article tags)

    Args:
        filecontent: HTML code as binary string or string.

    Returns:
        A LXML <body> element containing the extracted paragraphs,
        the main text as string, and its length as integer.
    """
    tree = load_html(filecontent)
    postbody = Element('body')
    if tree is None:
        return postbody, '', 0

    # ── Strategy 1: Enhanced JSON-LD ──────────────────────────────
    jsonld_result = extract_jsonld_content(filecontent)
    if jsonld_result and jsonld_result.get("content") and len(jsonld_result["content"]) > 100:
        text = trim(jsonld_result["content"])
        for part in text.split("\n\n"):
            part_trimmed = trim(part)
            if part_trimmed:
                for subpart in part_trimmed.split("\n"):
                    sp_trimmed = trim(subpart)
                    if sp_trimmed:
                        SubElement(postbody, 'p').text = sp_trimmed
        LOGGER.debug("baseline: JSON-LD extracted %s chars", len(text))
        normalized_text = "\n\n".join(trim(p.text) for p in postbody if p.text)
        return postbody, normalized_text, len(normalized_text)

    # ── Strategy 2: __NEXT_DATA__ (Next.js) ───────────────────────
    next_result = extract_next_data(filecontent)
    if next_result and next_result.get("content") and len(next_result["content"]) > 100:
        text = trim(next_result["content"])
        for part in text.split("\n\n"):
            part_trimmed = trim(part)
            if part_trimmed:
                for subpart in part_trimmed.split("\n"):
                    sp_trimmed = trim(subpart)
                    if sp_trimmed:
                        SubElement(postbody, 'p').text = sp_trimmed
        LOGGER.debug("baseline: __NEXT_DATA__ extracted %s chars", len(text))
        normalized_text = "\n\n".join(trim(p.text) for p in postbody if p.text)
        return postbody, normalized_text, len(normalized_text)

    # ── Strategy 3: <noscript> fallback ───────────────────────────
    noscript_result = extract_noscript_content(filecontent)
    if noscript_result and noscript_result.get("content") and len(noscript_result["content"]) > 100:
        text = trim(noscript_result["content"])
        for part in text.split("\n\n"):
            part_trimmed = trim(part)
            if part_trimmed:
                for subpart in part_trimmed.split("\n"):
                    sp_trimmed = trim(subpart)
                    if sp_trimmed:
                        SubElement(postbody, 'p').text = sp_trimmed
        LOGGER.debug("baseline: noscript extracted %s chars", len(text))
        normalized_text = "\n\n".join(trim(p.text) for p in postbody if p.text)
        return postbody, normalized_text, len(normalized_text)

    # ── Strategy 4: Original JSON-LD (articleBody only, backward compat) ──
    temp_text = ""
    for elem in tree.iterfind('.//script[@type="application/ld+json"]'):
        if elem.text and 'articleBody' in elem.text:
            try:
                json_body = json.loads(elem.text).get("articleBody", "")
            except Exception:
                json_body = ""
            if json_body:
                if "<p>" in json_body:
                    parsed = load_html(json_body)
                    text = trim(parsed.text_content()) if parsed is not None else ""
                else:
                    text = trim(json_body)
                SubElement(postbody, 'p').text = text
                temp_text += " " + text if temp_text else text
    if len(temp_text) > 100:
        return postbody, temp_text, len(temp_text)

    tree = basic_cleaning(tree)

    # ── Strategy 5: Article tag ────────────────────────────────────
    temp_text = ""
    for article_elem in tree.iterfind('.//article'):
        text = trim(article_elem.text_content())
        if len(text) > 100:
            SubElement(postbody, 'p').text = text
            temp_text += " " + text if temp_text else text
    if len(postbody) > 0:
        return postbody, temp_text, len(temp_text)

    # ── Strategy 6: Text paragraphs ────────────────────────────────
    results = set()
    temp_text = ""
    for element in tree.iter('blockquote', 'code', 'p', 'pre', 'q', 'quote'):
        entry = trim(element.text_content())
        if entry not in results:
            SubElement(postbody, 'p').text = entry
            temp_text += " " + entry if temp_text else entry
            results.add(entry)
    if len(temp_text) > 100:
        return postbody, temp_text, len(temp_text)

    # ── Strategy 7: Heuristic density ──────────────────────────────
    heuristic_result = extract_heuristic_density(filecontent)
    if heuristic_result and heuristic_result.get("content") and len(heuristic_result["content"]) > 200:
        text = trim(heuristic_result["content"])
        SubElement(postbody, 'p').text = text
        LOGGER.debug("baseline: heuristic extracted %s chars", len(text))
        return postbody, text, len(text)

    # ── Strategy 8: Default — take everything from body ───────────
    postbody = Element('body')
    body_elem = tree.find('.//body')
    if body_elem is not None:
        p_elem = SubElement(postbody, 'p')
        text_elems = [trim(e) for e in body_elem.itertext()]
        p_elem.text = '\n'.join([e for e in text_elems if e])
        return postbody, p_elem.text, len(p_elem.text)

    # ── Strategy 9: Last resort — html2txt ─────────────────────────
    text = html2txt(tree, clean=False)
    SubElement(postbody, 'p').text = text
    return postbody, text, len(text)


def html2txt(content: Any, clean: bool = True) -> str:
    """Run basic html2txt on a document.

    Args:
        content: HTML document as string or LXML element.
        clean: remove potentially undesirable elements.

    Returns:
        The extracted text in the form of a string or an empty string.

    """
    tree = load_html(content)
    if tree is None:
        return ""
    body = tree.find(".//body")
    if body is None:
        return ""
    if clean:
        body = basic_cleaning(body)
    return " ".join(body.text_content().split()).strip()