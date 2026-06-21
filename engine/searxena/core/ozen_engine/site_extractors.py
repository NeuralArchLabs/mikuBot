"""
Site-specific extractors for O-ZEN Engine.

Handles sites that require special extraction strategies:
- Reddit: old.reddit.com HTML + JS challenge resolution
- YouTube: oEmbed API for video metadata

These extractors are part of O-ZEN Engine, not external to it.
"""
import re
import json
import logging
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlparse, urlencode, parse_qs

from lxml import html as lxml_html
from lxml.etree import Element, SubElement

from .utils import load_html, trim

LOGGER = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Reddit JS Challenge Resolver
# ─────────────────────────────────────────────────────────────────────────────

def detect_reddit_challenge(html_text: str) -> bool:
    """Detect if the page is a Reddit JS verification challenge."""
    if not html_text:
        return False
    return (
        "Please wait for verification" in html_text
        or ("js_challenge" in html_text and "requestSubmit" in html_text)
    )


def solve_reddit_challenge(html_text: str) -> Optional[Dict[str, str]]:
    """
    Extract and solve the Reddit JS challenge.
    
    The challenge is: await(async e => e+e)("hex_string")
    Solution: concatenate the hex string with itself.
    """
    if not html_text:
        return None

    # Extract hex string from the challenge script
    match = re.search(r'\(async\s+e\s*=>\s*e\+e\)\("([a-f0-9]+)"\)', html_text)
    if not match:
        match = re.search(r'e\+e\)\("([a-f0-9]+)"\)', html_text)
    if not match:
        return None

    hex_value = match.group(1)
    solution = hex_value + hex_value

    # Extract token from form
    token_match = re.search(r'name="token"\s+value="([^"]+)"', html_text)
    token = token_match.group(1) if token_match else ""

    jsc_match = re.search(r'name="jsc_orig_r"\s+value="([^"]*)"', html_text)
    jsc_orig_r = jsc_match.group(1) if jsc_match else ""

    LOGGER.debug("Reddit challenge solved: solution=%s...", solution[:20])

    return {
        "solution": solution,
        "js_challenge": "1",
        "token": token,
        "jsc_orig_r": jsc_orig_r,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Reddit Post Extractor
# ─────────────────────────────────────────────────────────────────────────────

def extract_reddit_post(html_text: str, url: str) -> Optional[Dict[str, Any]]:
    """
    Extract a Reddit post and comments from old.reddit.com HTML.
    
    Uses selectolax to parse the traditional HTML structure:
    - div.thing: post container
    - div.usertext-body div.md: post selftext
    - div.comment: comment containers
    
    Returns:
        Dict with {title, author, subreddit, score, selftext, comments} or None
    """
    if not html_text or len(html_text) < 5000:
        return None

    try:
        from selectolax.parser import HTMLParser
    except ImportError:
        return None

    tree = HTMLParser(html_text)
    things = tree.css('div.thing')
    if not things:
        return None

    post = things[0]

    # Extract title
    title_node = post.css_first('a.title, p.title a')
    title = title_node.text().strip() if title_node else "Post de Reddit"

    # Extract selftext (post body)
    selftext_node = post.css_first('div.usertext-body div.md')
    selftext = selftext_node.text().strip() if selftext_node else ""

    # Extract metadata
    author_node = post.css_first('p.tagline a.author, a.author')
    author = author_node.text().strip() if author_node else "unknown"

    score_node = post.css_first('div.score.unvoted')
    score = score_node.text().strip() if score_node else "?"

    subreddit = post.attributes.get('data-subreddit', '')
    if not subreddit:
        m = re.search(r'/r/(\w+)/', url)
        subreddit = m.group(1) if m else 'reddit'

    # Extract comments
    comments = []
    for c in tree.css('div.comment'):
        c_author = c.css_first('a.author')
        c_body = c.css_first('div.usertext-body div.md')
        c_author_text = c_author.text().strip() if c_author else "?"
        c_body_text = c_body.text().strip() if c_body else ""
        if c_body_text and c_body_text not in ("[deleted]", "[removed]"):
            comments.append({
                "author": c_author_text,
                "body": c_body_text
            })

    # Calculate word count
    all_text = selftext + " " + " ".join(c["body"] for c in comments)
    word_count = len(all_text.split())

    if word_count < 5:
        return None

    return {
        "title": title,
        "author": author,
        "subreddit": subreddit,
        "score": score,
        "selftext": selftext,
        "comments": comments[:15],  # Top 15
        "word_count": word_count,
    }


def reddit_markdown_to_html(text: str) -> str:
    """Convert basic Reddit markdown to HTML for Reader Mode."""
    if not text:
        return ""

    # Escape HTML
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    # Code blocks ```
    text = re.sub(r'```(\w*)\n(.*?)```', r'<pre><code>\2</code></pre>', text, flags=re.DOTALL)
    # Inline code
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    # Bold
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    # Italic
    text = re.sub(r'\*([^*]+)\*', r'<em>\1</em>', text)
    text = re.sub(r'_([^_]+)_', r'<em>\1</em>', text)
    # Links
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)

    return text


def build_reddit_reader_html(post_data: Dict[str, Any], url: str) -> str:
    """Build HTML for Reader Mode from extracted Reddit post data."""
    content_html = f"<article class='reddit-post'>"
    content_html += (
        f"<div class='reddit-meta'>"
        f"<p><strong>r/{post_data['subreddit']}</strong> · "
        f"Posted by u/{post_data['author']} · {post_data['score']} points</p>"
        f"</div>"
    )

    if post_data.get("selftext"):
        for p in post_data["selftext"].split("\n"):
            p = p.strip()
            if p:
                content_html += f"<p>{p}</p>"
    else:
        content_html += f"<p><em>Post de enlace</em></p>"

    if post_data.get("comments"):
        content_html += "<hr/><h3>Comentarios</h3>"
        for c in post_data["comments"]:
            body = c["body"].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            content_html += (
                f"<div class='reddit-comment'>"
                f"<p><strong>u/{c['author']}</strong></p>"
                f"<div>{body}</div>"
                f"</div>"
            )

    content_html += "</article>"
    return content_html


# ─────────────────────────────────────────────────────────────────────────────
# YouTube oEmbed Extractor
# ─────────────────────────────────────────────────────────────────────────────

def extract_youtube_video_id(url: str) -> Optional[str]:
    """Extract YouTube video ID from URL."""
    if "watch" in url:
        match = re.search(r'[?&]v=([a-zA-Z0-9_-]{11})', url)
        if match:
            return match.group(1)
    elif "youtu.be" in url:
        match = re.search(r'youtu\.be/([a-zA-Z0-9_-]{11})', url)
        if match:
            return match.group(1)
    return None


def build_youtube_oembed_url(video_id: str) -> str:
    """Build the oEmbed API URL for a YouTube video."""
    return f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"


def build_youtube_reader_html(data: Dict[str, str], url: str) -> str:
    """Build HTML for Reader Mode from YouTube oEmbed data."""
    content_html = f"<article class='youtube-video'>"
    if data.get("html"):
        content_html += f"<div class='video-embed'>{data['html']}</div>"
    content_html += f"<h1>{data.get('title', '')}</h1>"
    content_html += f"<p>Canal: <strong>{data.get('author_name', '')}</strong></p>"
    content_html += f"<p><a href='{url}'>Ver en YouTube</a></p>"
    content_html += f"</article>"
    return content_html


# ─────────────────────────────────────────────────────────────────────────────
# MSN API Extractor
# ─────────────────────────────────────────────────────────────────────────────

def extract_msn_article_id(url: str) -> Optional[str]:
    """Extract the article ID from the MSN URL (usually after /ar-)."""
    if not url:
        return None
    # Match the part after /ar- that consists of alphanumeric characters
    match = re.search(r'/ar-([a-zA-Z0-9]+)', url)
    if match:
        return match.group(1)
    return None


def extract_msn_locale(url: str) -> str:
    """Extract the locale (e.g. es-es, en-us) from the MSN URL, default to es-es."""
    if not url:
        return "es-es"
    match = re.search(r'msn\.com/([a-z]{2}-[a-z]{2})/', url, re.IGNORECASE)
    if match:
        return match.group(1).lower()
    return "es-es"


def build_msn_api_url(article_id: str, locale: str) -> str:
    """Build the backend API URL for an MSN article."""
    return f"https://assets.msn.com/content/view/v2/Detail/{locale}/{article_id}"


def process_msn_body(body_html: str, image_resources: list) -> str:
    """Replace image placeholders in body HTML with actual URLs from imageResources."""
    if not body_html:
        return ""
    
    try:
        # Load body using lxml to cleanly find and replace attributes
        body_tree = lxml_html.fromstring(f"<div>{body_html}</div>")
        
        # Build map of cmsId to real image URL
        img_map = {}
        for img in image_resources:
            cms_id = img.get("cmsId")
            img_url = img.get("url")
            if cms_id and img_url:
                img_map[cms_id] = img_url
        
        # Find img tags and update their src attributes
        from urllib.parse import quote_plus
        for img_el in body_tree.xpath("//img"):
            doc_id = img_el.get("data-document-id") or img_el.get("data-id")
            if doc_id in img_map:
                img_url = img_map[doc_id]
                img_el.set("src", f"/proxify?url={quote_plus(img_url)}")
                img_el.attrib.pop("data-reference", None)
                
        from lxml.etree import tostring
        result_html = tostring(body_tree, encoding="utf-8").decode("utf-8")
        if result_html.startswith("<div>") and result_html.endswith("</div>"):
            result_html = result_html[5:-6]
        return result_html
    except Exception as e:
        LOGGER.warning("Error processing MSN body images: %s", e)
        return body_html


# ─────────────────────────────────────────────────────────────────────────────
# Milenio Liveblog & Social Embed Recovery
# ─────────────────────────────────────────────────────────────────────────────

def extract_milenio_liveblog(html_content: str, page_url: str) -> Optional[str]:
    """
    Extract rich liveblog updates from Milenio's HTML timeline.
    Recovers text, images, and video/social embeds for each update.
    """
    try:
        from lxml.html import fromstring as html_fromstring, tostring
        from urllib.parse import quote_plus, urljoin
        import re

        tree = html_fromstring(html_content)
        updates_ul = tree.xpath("//ul[contains(@class, 'content-columns__live-ul')]")
        if not updates_ul:
            return None

        li_elements = updates_ul[0].xpath("./li[contains(@class, 'nd-rows-detail-row-live')]")
        if not li_elements:
            # Fallback to any li elements that have an ID and aren't advertisements
            li_elements = [li for li in updates_ul[0].xpath("./li") if li.get("id") and "ad-" not in (li.get("class") or "")]

        if not li_elements:
            return None

        content_html = ""
        for li in li_elements:
            # Get the timestamp
            title_el = li.find('.//span[@class="nd-rows-detail-row-live__title"]')
            timestamp = (title_el.text_content() or "").strip() if title_el is not None else ""

            # Get the body div
            body_el = li.find('.//div[@class="nd-rows-detail-row-live__body"]')
            if body_el is None:
                body_el = li.find('.//div[@id="content-body"]')

            if body_el is None:
                continue

            # Process all images in this update body
            for img in body_el.xpath(".//img"):
                img_src = img.get("src") or img.get("data-src")
                if img_src:
                    # Normalize relative URLs
                    img_src = urljoin(page_url, img_src)
                    # Avoid placeholder images or expansion/zoom icons
                    if "logo-Milenio" not in img_src and "expand-solid" not in img_src:
                        img.set("src", f"/proxify?url={quote_plus(img_src)}")
                        img.attrib.pop("onerror", None)
                        img.attrib.pop("loading", None)
                        img.attrib.pop("class", None)
                    else:
                        # Remove placeholder/icon
                        parent = img.getparent()
                        if parent is not None:
                            parent.remove(img)

            # Remove expand/zoom buttons
            for btn in body_el.xpath(".//button[contains(@class, 'zoom')]"):
                btn_parent = btn.getparent()
                if btn_parent is not None:
                    btn_parent.remove(btn)

            # Process all blockquotes (Twitter/Instagram) and convert them to iframes
            for embed in body_el.xpath(".//blockquote[contains(@class, 'twitter-tweet')] | .//blockquote[contains(@class, 'instagram-media')]"):
                embed_str = tostring(embed, encoding="utf-8").decode("utf-8")
                is_converted = False
                embed_copy = None
                
                import html
                fallback_text = html.escape(embed.text_content().strip())
                
                if "twitter-tweet" in embed_str.lower():
                    for link in embed.xpath(".//a"):
                        href = link.get("href") or ""
                        match = re.search(r'/status/(\d+)', href)
                        if match:
                            tweet_id = match.group(1)
                            iframe_src = f"https://platform.twitter.com/embed/Tweet.html?id={tweet_id}"
                            embed_copy = html_fromstring(f"<iframe src='{iframe_src}' width='100%' height='450' frameborder='0' allowfullscreen>{fallback_text}</iframe>")
                            is_converted = True
                            break

                elif "instagram-media" in embed_str.lower():
                    for link in embed.xpath(".//a"):
                        href = link.get("href") or ""
                        if "instagram.com/p/" in href or "instagram.com/reel/" in href:
                            clean_url = href.split("?")[0].rstrip("/")
                            embed_copy = html_fromstring(f"<iframe src='{clean_url}/embed/' width='100%' height='450' frameborder='0' allowfullscreen>{fallback_text}</iframe>")
                            is_converted = True
                            break

                if is_converted and embed_copy is not None:
                    parent = embed.getparent()
                    if parent is not None:
                        idx_in_parent = parent.index(embed)
                        parent.insert(idx_in_parent, embed_copy)
                        parent.remove(embed)

            # Clean up iframes: keep only social/video embedding
            for iframe in body_el.xpath(".//iframe"):
                src = iframe.get("src") or ""
                # If it's a twitter widget iframe, we can rewrite it or keep it
                if "twitter.com" in src or "x.com" in src or "youtube.com" in src:
                    # Ensure standard iframe properties
                    iframe.set("width", "100%")
                    iframe.set("height", "450")
                    iframe.attrib.pop("class", None)
                    iframe.attrib.pop("style", None)
                else:
                    # Remove other arbitrary/tracking iframes
                    iframe_parent = iframe.getparent()
                    if iframe_parent is not None:
                        iframe_parent.remove(iframe)

            # Keep Twitter/social blockquotes and clean them if necessary
            # Build the cleaned body HTML
            body_parts = []
            for child in body_el:
                # Strip any empty paragraphs or comments
                child_html = tostring(child, encoding="utf-8").decode("utf-8")
                body_parts.append(child_html)
            
            update_body_html = "\n".join(body_parts)

            content_html += f"<div class='liveblog-update'>"
            if timestamp:
                content_html += f"<h3>{timestamp}</h3>"
            content_html += f"<div>{update_body_html}</div>"
            content_html += f"</div>"

        return content_html if content_html else None

    except Exception as e:
        LOGGER.warning("Milenio HTML liveblog extraction failed: %s", e)
        return None


def inject_missing_embeds(content_html: Optional[str], raw_html: str, page_url: str) -> Optional[str]:
    """
    Scan raw HTML for social and video embeds (Twitter/X, Instagram, YouTube)
    that O-ZEN's standard extraction/readability filters stripped out.
    Re-injects them at the correct positions in content_html based on surrounding text anchors.
    """
    if not content_html or not raw_html:
        return content_html

    try:
        from lxml.html import fromstring as html_fromstring, tostring
        import re

        raw_tree = html_fromstring(raw_html)
        
        # Find candidate embeds: blockquotes with class, and iframes from specific platforms
        embed_xpath = (
            "//blockquote[contains(@class, 'twitter-tweet')] | "
            "//blockquote[contains(@class, 'instagram-media')] | "
            "//blockquote[contains(@class, 'tiktok-embed')] | "
            "//iframe[contains(@src, 'twitter.com')] | "
            "//iframe[contains(@src, 'x.com')] | "
            "//iframe[contains(@src, 'youtube.com')] | "
            "//iframe[contains(@src, 'vimeo.com')] | "
            "//iframe[contains(@src, 'instagram.com')] | "
            "//iframe[contains(@src, 'tiktok.com')]"
        )
        
        raw_embeds = raw_tree.xpath(embed_xpath)
        if not raw_embeds:
            return content_html

        # Check if has html or body wrapper
        has_html_wrapper = ('<html' in content_html.lower() or '<body' in content_html.lower())
        if not has_html_wrapper:
            ext_tree = html_fromstring(f"<div>{content_html}</div>")
        else:
            ext_tree = html_fromstring(content_html)

        def clean_for_match(t):
            return re.sub(r'\s+', '', t).lower()

        inserted_any = False

        for embed in raw_embeds:
            # Serialize embed to make a copy
            embed_str = tostring(embed, encoding="utf-8").decode("utf-8")
            
            # Check if it is already present in content_html to avoid duplicates
            tweet_id = embed.get("data-tweet-id") or ""
            if tweet_id and tweet_id in content_html:
                continue
            if clean_for_match(embed_str)[:100] in clean_for_match(content_html):
                continue

            # Find preceding text in raw HTML (walk backwards)
            preceding_texts = embed.xpath("preceding::text()")
            preceding_anchor = ""
            for text in reversed(preceding_texts):
                cleaned = text.strip()
                if len(cleaned) > 20:
                    preceding_anchor = cleaned[-40:]
                    break
            
            if not preceding_anchor:
                continue

            # Locate matching element in ext_tree
            prec_clean = clean_for_match(preceding_anchor)
            prec_el = None
            for el in ext_tree.iter('*'):
                if el == ext_tree or el.tag in ('html', 'body'):
                    continue
                text_val = el.text or ""
                content_val = el.text_content() or ""
                if prec_clean in clean_for_match(text_val) or prec_clean in clean_for_match(content_val):
                    prec_el = el
                    for child in el.iterdescendants('*'):
                        if prec_clean in clean_for_match(child.text or "") or prec_clean in clean_for_match(child.text_content() or ""):
                            prec_el = child

            if prec_el is not None:
                # Find highest block ancestor below body/wrapper
                curr = prec_el
                while curr.getparent() is not None and curr.getparent().tag not in ('body', 'html') and curr.getparent() != ext_tree:
                    curr = curr.getparent()

                # Clone and convert standard embeds (Twitter, Instagram) to clean iframes
                is_converted = False
                embed_copy = None
                
                import html
                fallback_text = html.escape(embed.text_content().strip())
                
                if "twitter-tweet" in embed_str.lower():
                    for link in embed.xpath(".//a"):
                        href = link.get("href") or ""
                        match = re.search(r'/status/(\d+)', href)
                        if match:
                            tweet_id = match.group(1)
                            iframe_src = f"https://platform.twitter.com/embed/Tweet.html?id={tweet_id}"
                            embed_copy = html_fromstring(f"<iframe src='{iframe_src}' width='100%' height='450' frameborder='0' allowfullscreen>{fallback_text}</iframe>")
                            is_converted = True
                            break

                elif "instagram-media" in embed_str.lower():
                    for link in embed.xpath(".//a"):
                        href = link.get("href") or ""
                        if "instagram.com/p/" in href or "instagram.com/reel/" in href:
                            clean_url = href.split("?")[0].rstrip("/")
                            embed_copy = html_fromstring(f"<iframe src='{clean_url}/embed/' width='100%' height='450' frameborder='0' allowfullscreen>{fallback_text}</iframe>")
                            is_converted = True
                            break

                if not is_converted:
                    embed_copy = html_fromstring(embed_str)
                    # Clean up script tags inside the embed if any
                    for s in embed_copy.xpath(".//script"):
                        s.getparent().remove(s)
                    
                parent = curr.getparent()
                if parent is not None:
                    idx_in_parent = parent.index(curr)
                    parent.insert(idx_in_parent + 1, embed_copy)
                    inserted_any = True

        if not inserted_any:
            return content_html

        res_html = tostring(ext_tree, encoding="utf-8").decode("utf-8")
        if not has_html_wrapper:
            if res_html.startswith("<div>") and res_html.endswith("</div>"):
                res_html = res_html[5:-6]
            elif "<body>" in res_html:
                start = res_html.find("<body>") + 6
                end = res_html.rfind("</body>")
                res_html = res_html[start:end]
        return res_html

    except Exception as e:
        LOGGER.warning("Failed to recover missing embeds: %s", e)
        return content_html


def extract_nextjs_liveblog(html_content: str) -> Optional[str]:
    """
    Extract rich liveblog updates from Next.js self.__next_f payload.
    Recovers text, images, and video/social embeds for each update.
    """
    try:
        import re
        import json
        from urllib.parse import quote_plus

        # Combine all self.__next_f.push payloads
        next_f_matches = re.findall(r'self\.__next_f\.push\(\[\d+,\s*"(.*?)"\]\)', html_content, re.DOTALL)
        if not next_f_matches:
            return None
            
        full_payload = ""
        for m in next_f_matches:
            try:
                decoded = m.encode('utf-8').decode('unicode-escape').encode('latin-1').decode('utf-8')
                full_payload += decoded
            except Exception:
                try:
                    decoded = m.encode().decode('unicode-escape', errors='ignore')
                    full_payload += decoded
                except Exception:
                    pass
        
        if not full_payload:
            return None
            
        # Find all 24-character hexadecimal IDs followed by "title"
        update_ids = re.findall(r'"id"\s*:\s*"([a-f0-9]{24})"\s*,\s*"title"\s*:', full_payload)
        if not update_ids:
            return None
            
        updates = []
        seen_ids = set()
        
        for uid in update_ids:
            if uid in seen_ids:
                continue
            seen_ids.add(uid)
            
            # Locate the object boundaries
            pattern = f'"id"\\s*:\\s*"{uid}"'
            match = re.search(pattern, full_payload)
            if not match:
                continue
            
            start_pos = match.start()
            obj_start = -1
            for pos in range(start_pos, 0, -1):
                if full_payload[pos] == '{':
                    obj_start = pos
                    break
            if obj_start == -1:
                continue
                
            brace_count = 0
            obj_end = -1
            for pos in range(obj_start, len(full_payload)):
                char = full_payload[pos]
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        obj_end = pos + 1
                        break
                        
            if obj_end == -1:
                continue
                
            try:
                update_obj = json.loads(full_payload[obj_start:obj_end])
                if "title" in update_obj and "createdAt" in update_obj and "content" in update_obj:
                    updates.append(update_obj)
            except Exception:
                pass
                
        if not updates:
            return None
            
        content_html = ""
        for update in updates:
            title = update.get("title") or ""
            content_html += f"<div class='liveblog-update'>"
            if title:
                content_html += f"<h3>{title}</h3>"
                
            root = update.get("content", {}).get("root", {})
            children = root.get("children", [])
            
            for child in children:
                c_type = child.get("type")
                if c_type == "paragraph":
                    para_text = ""
                    for subchild in child.get("children", []):
                        if subchild.get("type") == "text":
                            para_text += subchild.get("text", "")
                    if para_text.strip():
                        content_html += f"<p>{para_text.strip()}</p>"
                        
                elif c_type == "block":
                    fields = child.get("fields", {})
                    block_type = child.get("blockType") or fields.get("blockType") or fields.get("provider")
                    
                    if block_type == "imageBlock" or "media" in fields:
                        media = fields.get("media") or fields
                        sizes = media.get("sizes", {})
                        img_url = ""
                        for size_key in ("landscape", "og", "square", "original"):
                            if size_key in sizes and isinstance(sizes[size_key], dict):
                                img_url = sizes[size_key].get("url")
                                if img_url:
                                    break
                        if not img_url:
                            img_url = media.get("url")
                            
                        if img_url:
                            proxified_url = f"/proxify?url={quote_plus(img_url)}"
                            caption = media.get("caption") or media.get("alt") or ""
                            cap_html = f"<figcaption>{caption}</figcaption>" if caption else ""
                            content_html += f"<figure class='liveblog-image'><img src='{proxified_url}' alt='{caption}' loading='lazy'/>{cap_html}</figure>"
                            
                    elif block_type == "oEmbed" or "url" in fields:
                        embed_url = fields.get("url")
                        provider = fields.get("provider") or ""
                        
                        if embed_url:
                            iframe_url = None
                            if "instagram.com" in embed_url.lower():
                                clean_url = embed_url.split("?")[0].rstrip("/")
                                iframe_url = f"{clean_url}/embed/"
                            elif "x.com" in embed_url.lower() or "twitter.com" in embed_url.lower():
                                tweet_id_match = re.search(r'/status/(\d+)', embed_url)
                                if tweet_id_match:
                                    iframe_url = f"https://platform.twitter.com/embed/Tweet.html?id={tweet_id_match.group(1)}"
                                    
                            if iframe_url:
                                content_html += f"<iframe src='{iframe_url}' width='100%' height='450' frameborder='0' allowfullscreen></iframe>"
                            else:
                                content_html += f"<p><a href='{embed_url}' target='_blank'>Ver contenido incrustado de {provider.capitalize() or 'redes sociales'}</a></p>"
                                
            content_html += "</div>"
            
        return content_html
        
    except Exception as e:
        LOGGER.warning("Failed to parse Next.js liveblog updates: %s", e)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Core Extraction Pipeline & Helpers (relocated from extractor.py)
# ─────────────────────────────────────────────────────────────────────────────

def clean_ad_placeholders(content_html: Optional[str]) -> Optional[str]:
    """Remove any elements (paragraphs, divs, etc.) that contain only ad labels (e.g. 'PUBLICIDAD')."""
    if not content_html:
        return content_html

    try:
        from lxml.html import fromstring as html_fromstring, tostring
        
        # Check if it has html or body tags
        has_html_wrapper = ('<html' in content_html.lower() or '<body' in content_html.lower())
        
        if not has_html_wrapper:
            tree = html_fromstring(f"<div>{content_html}</div>")
        else:
            tree = html_fromstring(content_html)
        
        AD_LABELS = {
            'publicidad', 'anuncio', 'anuncios', 'advertisement', 'advertising',
            'sponsored', 'patrocinado', 'patrocinados', 'promo', 'promocion',
            'promoción', 'ads', 'ad'
        }
        
        to_remove = []
        for el in tree.iter('*'):
            if el.tag in ('p', 'div', 'span', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
                text = (el.text_content() or '').strip()
                if text:
                    cleaned = ''.join(c for c in text if c.isalnum() or c.isspace()).lower().strip()
                    if cleaned in AD_LABELS:
                        to_remove.append(el)
        
        # Remove elements (parent-first to avoid stale refs)
        removed_ids = set()
        for el in to_remove:
            try:
                el_id = id(el)
                if el_id not in removed_ids and el.getparent() is not None:
                    el.getparent().remove(el)
                    removed_ids.add(el_id)
            except Exception:
                pass
        
        res = tostring(tree, encoding='utf-8').decode('utf-8')
        if not has_html_wrapper:
            if res.startswith('<div>') and res.endswith('</div>'):
                res = res[5:-6]
            elif '<body>' in res:
                start = res.find('<body>') + 6
                end = res.rfind('</body>')
                res = res[start:end]
        return res
        
    except Exception as e:
        LOGGER.warning("Error cleaning ad placeholders: %s", e)
        return content_html


def inject_missing_images(content_html: Optional[str], raw_html: str, page_url: str) -> Optional[str]:
    """
    Scan raw HTML for images that O-ZEN missed (lazy-loading, srcset-only patterns).
    Uses a two-phase approach:
      1. Prune known boilerplate sections (related posts, sidebars, ads, nav) first.
      2. Only accept images that are genuine article content, not external link thumbnails.
    Hard cap: 6 images maximum to avoid flooding the reader.
    """
    if not content_html or not raw_html:
        return content_html

    try:
        from copy import deepcopy
        from urllib.parse import unquote_plus, urlparse as _urlparse, urljoin
        from lxml.html import fromstring as html_fromstring
        from urllib.parse import quote_plus
        import re

        tree = html_fromstring(raw_html)
        page_domain = _urlparse(page_url).netloc.lower().lstrip('www.')

        # ── Phase 1: prune boilerplate containers ────────────────────────────
        BOILERPLATE_KEYWORDS = (
            'related', 'recommend', 'suggestion', 'you-may', 'you-might',
            'more-from', 'also-read', 'more-on', 'trending', 'popular',
            'sidebar', 'widget', 'aside', 'newsletter', 'subscribe',
            'advertisement', 'adsense', 'promo', 'sponsor', 'promoted',
            'comment', 'disqus', 'navigation', 'breadcrumb', 'pagination',
            'footer', 'header', 'menu', 'nav-', '-nav', 'social-share',
            'share-', '-share', 'tag-cloud', 'author', 'avatar', 'profile', 'bio',
            'cookie', 'gdpr', 'banner', 'sticky', 'modal', 'popup',
            'outbrain', 'taboola', 'revcontent', 'zergnet',
        )

        work_tree = deepcopy(tree)
        to_remove = []
        for el in work_tree.iter('*'):
            el_class = (el.get('class') or '').lower()
            el_id    = (el.get('id')    or '').lower()
            combined = el_class + ' ' + el_id
            if any(kw in combined for kw in BOILERPLATE_KEYWORDS):
                to_remove.append(el)
        
        removed_ids = set()
        for el in to_remove:
            try:
                el_id = id(el)
                if el_id not in removed_ids and el.getparent() is not None:
                    el.getparent().remove(el)
                    removed_ids.add(el_id)
            except Exception:
                pass

        def _normalize_img_url(url_str: str) -> str:
            """Normalize image URLs by stripping common size patterns and query arguments for deduplication."""
            try:
                parsed = _urlparse(url_str)
                path = parsed.path.lower()
                
                path = re.sub(r'[-_]\d+x\d+(?=\.[a-z]{3,4}$)', '', path)
                path = re.sub(r'[-_]\d+_\d+(?=\.[a-z]{3,4}$)', '', path)
                path = re.sub(r'/width/\d+/', '/', path)
                path = re.sub(r'/height/\d+/', '/', path)
                
                query = parsed.query.lower()
                query = re.sub(r'(width|height|w|h|resize|size|scale|fit)=\d+&?', '', query)
                query = query.rstrip('&')
                
                norm = f"{parsed.netloc}{path}"
                if query:
                    norm += f"?{query}"
                return norm
            except Exception:
                return url_str.lower()

        # ── Phase 2: collect already-proxified images from extracted content ─
        existing_srcs = set()
        existing_re = re.compile(r'proxify\?url=([^"&\s]+)')
        for m in existing_re.finditer(content_html):
            existing_srcs.add(unquote_plus(m.group(1)))
        
        existing_normalized = {_normalize_img_url(src) for src in existing_srcs}

        # ── Phase 3: find candidate images in the pruned tree ────────────────
        candidate_xpaths = [
            './/article//img',
            './/main//img',
            './/*[contains(@class,"article-body")]//img',
            './/*[contains(@class,"article-content")]//img',
            './/*[contains(@class,"post-content")]//img',
            './/*[contains(@class,"entry-content")]//img',
            './/*[contains(@class,"story-body")]//img',
            './/*[contains(@class,"article")]//img',
            './/*[contains(@class,"content")]//img',
        ]

        def _resolve_img(img_el) -> Optional[str]:
            for attr in ('data-src', 'data-lazy-src', 'data-original',
                         'data-lazy', 'data-image', 'data-full-src', 'src'):
                val = (img_el.get(attr) or '').strip()
                if val and val.startswith('http'):
                    return val
            for attr in ('srcset', 'data-srcset'):
                srcset = (img_el.get(attr) or '').strip()
                if srcset:
                    best_url, best_w = '', 0
                    for entry in srcset.split(','):
                        parts = entry.strip().split()
                        if not parts or not parts[0].startswith('http'):
                            continue
                        w = 0
                        if len(parts) > 1:
                            try:
                                w = int(parts[1].rstrip('w'))
                            except ValueError:
                                pass
                        if w > best_w:
                            best_w, best_url = w, parts[0]
                    if best_url:
                        return best_url
            src = (img_el.get('src') or '').strip()
            if src and not src.startswith('data:'):
                return urljoin(page_url, src)
            return None

        def _is_inside_external_link(img_el) -> bool:
            current = img_el.getparent()
            depth = 0
            while current is not None and depth < 5:
                if current.tag == 'a':
                    href = (current.get('href') or '').strip()
                    if href:
                        abs_href = urljoin(page_url, href)
                        parsed_link = _urlparse(abs_href)
                        link_domain = parsed_link.netloc.lower().lstrip('www.')
                        
                        if any(parsed_link.path.lower().endswith(ext) for ext in ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg')):
                            break
                        
                        if link_domain != page_domain:
                            return True
                            
                        page_path = _urlparse(page_url).path.rstrip('/')
                        link_path = parsed_link.path.rstrip('/')
                        if page_path != link_path:
                            return True
                    break
                current = current.getparent()
                depth += 1
            return False

        def _is_inside_boilerplate(img_el) -> bool:
            current = img_el.getparent()
            depth = 0
            while current is not None and depth < 8:
                el_class = (current.get('class') or '').lower()
                el_id    = (current.get('id')    or '').lower()
                combined = el_class + ' ' + el_id
                if any(kw in combined for kw in BOILERPLATE_KEYWORDS):
                    return True
                current = current.getparent()
                depth += 1
            return False

        NOISE_TERMS = (
            'pixel', 'tracking', 'beacon', '.svg', 'logo', 'avatar',
            'author', 'profile', 'byline', 'placeholder', 'spinner', 'spacer',
            '1x1', '0x0', 'blank', 'gravatar', 'wp-includes', 'comentario',
            'comment', 'button', 'badge', 'ad-', '-ad', 'advertisement',
            'banner', 'newsletter', 'subscribe'
        )

        seen = set()
        seen_normalized = set()
        recovered_imgs = []
        MAX_IMAGES = 6

        for xpath in candidate_xpaths:
            if len(recovered_imgs) >= MAX_IMAGES:
                break
            for img in work_tree.xpath(xpath):
                if len(recovered_imgs) >= MAX_IMAGES:
                    break

                img_url = _resolve_img(img)
                if not img_url:
                    continue

                norm_url = _normalize_img_url(img_url)
                if img_url in seen or norm_url in seen_normalized or norm_url in existing_normalized:
                    continue

                alt = (img.get('alt') or '').strip()
                if any(p in img_url.lower() for p in NOISE_TERMS) or any(p in alt.lower() for p in NOISE_TERMS):
                    continue

                try:
                    w = int(img.get('width', 300))
                    h = int(img.get('height', 200))
                    if w < 150 or h < 80:
                        continue
                except (ValueError, TypeError):
                    pass

                if _is_inside_external_link(img):
                    continue

                if _is_inside_boilerplate(img):
                    continue

                seen.add(img_url)
                seen_normalized.add(norm_url)

                parent = img.getparent()
                caption = ''
                if parent is not None and parent.tag == 'figure':
                    fig_cap = parent.find('.//figcaption')
                    if fig_cap is not None:
                        caption = (fig_cap.text_content() or '').strip()

                recovered_imgs.append((img_url, alt, caption or alt))

        if not recovered_imgs:
            return content_html

        img_blocks = []
        for img_url, alt, caption in recovered_imgs:
            proxified = f"/proxify?url={quote_plus(img_url)}"
            safe_caption = caption.replace('<', '&lt;').replace('>', '&gt;')
            cap_html = (f'<figcaption class="reader-img-caption">{safe_caption}</figcaption>'
                        if safe_caption else '')
            img_blocks.append(
                f'<figure class="reader-recovered-img">'
                f'<img src="{proxified}" alt="{alt}" loading="lazy">'
                f'{cap_html}</figure>'
            )

        gallery_section = (
            f'<div class="recovered-images-section">'
            f'<hr class="reader-divider">'
            + '\n'.join(img_blocks) +
            f'</div>'
        )

        for closing in ('</body>', '</html>'):
            if closing in content_html:
                return content_html.replace(closing, gallery_section + closing, 1)
        return content_html + gallery_section

    except Exception as e:
        LOGGER.warning("Image recovery failed: %s", e)
        return content_html


# ── Site-Specific Asynchronous Fetchers ──────────────────────────────────────

async def extract_reddit(url: str, client) -> Optional[Dict]:
    """Fetch and extract Reddit post old.reddit HTML securely."""
    try:
        old_url = url.replace("www.reddit.com", "old.reddit.com")
        if "?" in old_url:
            old_url = old_url.split("?")[0]

        resp = await client.get(old_url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept-Encoding": "gzip, deflate",
            "Accept-Language": "en-US,en;q=0.9",
        })
        cookies = dict(resp.cookies)
        html = resp.text

        if detect_reddit_challenge(html):
            LOGGER.info("O-ZEN: Reddit challenge detectado, resolviendo...")
            sol = solve_reddit_challenge(html)
            if sol:
                from urllib.parse import urlencode, urlparse as up
                parsed = up(old_url)
                challenge_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}?{urlencode({'solution': sol['solution'], 'js_challenge': '1', 'token': sol['token']})}"
                resp2 = await client.get(challenge_url, headers={"User-Agent": "Mozilla/5.0"}, cookies=cookies)
                cookies.update(dict(resp2.cookies))
                html = resp2.text

        if len(html) < 5000:
            return None

        post_data = extract_reddit_post(html, old_url)
        if not post_data:
            return None

        content_html = build_reddit_reader_html(post_data, url)
        LOGGER.info(f"O-ZEN: Reddit post extraído: {post_data['word_count']} palabras")

        return {
            "metadata": {
                "title": post_data["title"], "author": f"u/{post_data['author']}",
                "date": "", "description": f"Post en r/{post_data['subreddit']}",
                "image": "", "site_name": f"r/{post_data['subreddit']}", "url": url
            },
            "content": content_html,
            "word_count": post_data["word_count"],
            "status": "success (reddit old)",
            "render_method": "reddit_api"
        }
    except Exception as e:
        LOGGER.warning("Reddit extraction error: %s", e)
        return None


async def extract_youtube(url: str, client) -> Optional[Dict]:
    """Fetch and extract YouTube video details using the oEmbed API."""
    try:
        video_id = extract_youtube_video_id(url)
        if not video_id:
            return None

        oembed_url = build_youtube_oembed_url(video_id)
        resp = await client.get(oembed_url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
            "Accept-Encoding": "gzip, deflate",
        })
        if resp.status_code != 200:
            return None

        data = resp.json()
        title = data.get("title", "")
        author = data.get("author_name", "")
        thumbnail = data.get("thumbnail_url", "")
        html_embed = data.get("html", "")

        if not title:
            return None

        content_html = build_youtube_reader_html({"title": title, "author_name": author, "html": html_embed}, url)
        word_count = len((title + " " + author).split())
        LOGGER.info(f"O-ZEN: YouTube oEmbed extrajo '{title[:40]}'")

        return {
            "metadata": {"title": title, "author": author, "date": "",
                          "description": f"Video de YouTube por {author}",
                          "image": thumbnail, "site_name": "YouTube", "url": url},
            "content": content_html,
            "word_count": word_count,
            "status": "success (youtube oembed)",
            "render_method": "youtube_api"
        }
    except Exception as e:
        LOGGER.warning("YouTube oEmbed error: %s", e)
        return None


async def extract_msn(url: str, client) -> Optional[Dict]:
    """Fetch and extract MSN articles using the MSN Detail API."""
    try:
        article_id = extract_msn_article_id(url)
        if not article_id:
            return None
        
        locale = extract_msn_locale(url)
        api_url = build_msn_api_url(article_id, locale)
        
        LOGGER.info(f"O-ZEN: Fetching MSN article from Detail API: {api_url}")
        
        # Override headers for API client to behave properly
        resp = await client.get(api_url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json"
        })
        
        if resp.status_code in (404, 410):
            LOGGER.warning(f"O-ZEN: MSN article not found ({resp.status_code}) for ID {article_id}")
            return {
                "metadata": {"title": f"Error {resp.status_code} — MSN", "site_name": "msn.com", "url": url},
                "content": f"<div class='error-notice'><h3>⚠️ Artículo no disponible</h3><p>El artículo solicitado ya no está disponible en MSN (Error {resp.status_code}).</p><p><a href='{url}' target='_blank'>{url}</a></p></div>",
                "word_count": 0, "status": f"http_{resp.status_code}"
            }
        
        if resp.status_code != 200:
            LOGGER.warning(f"O-ZEN: MSN Detail API returned status {resp.status_code}")
            return None
        
        data = resp.json()
        title = data.get("title") or "Sin título"
        abstract = data.get("abstract") or ""
        body = data.get("body") or ""
        
        authors_list = data.get("authors") or []
        author = ", ".join(a["name"] for a in authors_list if isinstance(a, dict) and "name" in a)
        pub_date = data.get("publishedDateTime") or ""
        provider = data.get("provider") or {}
        provider_name = provider.get("name") or "MSN"
        
        image_resources = data.get("imageResources") or []
        processed_body = process_msn_body(body, image_resources)
        
        hero_image = ""
        if image_resources and isinstance(image_resources, list) and len(image_resources) > 0:
            hero_image = image_resources[0].get("url") or ""
        
        try:
            text_content = lxml_html.fromstring(f"<div>{processed_body}</div>").text_content()
        except Exception:
            text_content = processed_body
        word_count = len((text_content or "").split())
        
        LOGGER.info(f"O-ZEN: MSN article extracted successfully: {word_count} words")
        
        return {
            "metadata": {
                "title": title,
                "author": author,
                "date": pub_date,
                "description": abstract,
                "image": hero_image,
                "hero_image": hero_image,
                "site_name": provider_name,
                "url": url
            },
            "content": processed_body,
            "word_count": word_count,
            "status": "success (msn api)",
            "render_method": "msn_api"
        }
    except Exception as e:
        LOGGER.warning(f"MSN extraction error: {e}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# E-commerce Extractors & Formatters (Amazon, Mercado Libre, eBay)
# ─────────────────────────────────────────────────────────────────────────────

def build_product_reader_html(product_data: Dict[str, Any]) -> str:
    """Build a beautiful, responsive HTML product card for Reader Mode."""
    title = product_data.get("title") or "Producto sin título"
    price = product_data.get("price") or "Consultar precio"
    image_url = product_data.get("image") or ""
    rating = product_data.get("rating") or ""
    reviews_count = product_data.get("reviews") or ""
    bullets = product_data.get("bullets") or []
    description = product_data.get("description") or ""
    brand = product_data.get("brand") or ""
    site_name = product_data.get("site_name") or "Tienda"
    url = product_data.get("url") or "#"

    # Style colors based on site origin
    theme_color = "#3498db" # Default blue
    site_lower = site_name.lower()
    if "amazon" in site_lower:
        theme_color = "#ff9900" # Amazon Orange
    elif "mercado" in site_lower:
        theme_color = "#ffe600" # Mercado Libre Yellow
    elif "ebay" in site_lower:
        theme_color = "#e53238" # eBay Red

    # Proxify image if present
    from urllib.parse import quote_plus
    proxified_image = f"/proxify?url={quote_plus(image_url)}" if image_url else ""

    rating_stars_html = ""
    if rating:
        rating_stars_html = f"<span class='product-rating-stars' style='color: #f1c40f; font-weight: bold;'>★ {rating}</span>"

    bullets_html = ""
    if bullets:
        bullets_html = "<div class='product-bullets' style='margin-top: 20px; border-top: 1px solid #f0f0f0; padding-top: 15px;'><h3>Características principales:</h3><ul style='padding-left: 20px; color: #34495e; line-height: 1.6;'>"
        for b in bullets:
            bullets_html += f"<li style='margin-bottom: 8px;'>{b}</li>"
        bullets_html += "</ul></div>"

    desc_html = ""
    if description:
        paragraphs = description.split("\n")
        desc_html = "<div class='product-desc' style='margin-top: 20px; border-top: 1px solid #f0f0f0; padding-top: 15px;'><h3>Descripción:</h3>"
        for p in paragraphs:
            p_clean = p.strip()
            if p_clean:
                desc_html += f"<p style='color: #555555; line-height: 1.6; margin-bottom: 12px;'>{p_clean}</p>"
        desc_html += "</div>"

    html = f"""
    <div class="product-reader-card" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        
        <div class="product-source-badge" style="display: inline-block; padding: 4px 12px; border-radius: 20px; background-color: {theme_color}22; color: {theme_color}; font-size: 12px; font-weight: bold; margin-bottom: 15px; text-transform: uppercase;">
            {site_name}
        </div>
        
        <div class="product-main-section" style="display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 25px;">
            {"<div class='product-image-container' style='flex: 1 1 250px; text-align: center;'><img src='" + proxified_image + "' alt='" + title + "' style='max-width: 100%; max-height: 280px; object-fit: contain; border-radius: 8px;'/></div>" if proxified_image else ""}
            
            <div class="product-info-container" style="flex: 2 2 300px; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <h2 class="product-title-text" style="font-size: 22px; line-height: 1.3; color: #2c3e50; margin: 0 0 10px 0;">{title}</h2>
                    {f"<p class='product-brand-text' style='color: #7f8c8d; font-size: 14px; margin: 0 0 15px 0;'>{brand}</p>" if brand else ""}
                    
                    <div class="product-rating-container" style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: #7f8c8d; margin-bottom: 20px;">
                        {rating_stars_html}
                        {f"<span class='product-reviews-count'>({reviews_count})</span>" if reviews_count else ""}
                    </div>
                </div>
                
                <div class="product-price-section" style="border-top: 1px solid #f0f0f0; padding-top: 15px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
                    <div>
                        <span style="font-size: 12px; color: #95a5a6; display: block; text-transform: uppercase; margin-bottom: 4px;">Precio</span>
                        <span class="product-price-amount" style="font-size: 32px; font-weight: 800; color: #27ae60;">{price}</span>
                    </div>
                    
                    <a href="{url}" target="_blank" class="product-buy-btn" style="display: inline-block; padding: 12px 24px; border-radius: 8px; background-color: {theme_color}; color: {'#333333' if 'mercado' in site_lower else '#ffffff'}; font-weight: bold; text-decoration: none; font-size: 16px; text-align: center; box-shadow: 0 4px 6px {theme_color}33;">
                        Ver en {site_name.split('.')[0].capitalize()}
                    </a>
                </div>
            </div>
        </div>
        
        {bullets_html}
        {desc_html}
    </div>
    """
    return html


async def extract_amazon_product(url: str, client) -> Optional[Dict]:
    """Extract Amazon product page details securely."""
    try:
        from selectolax.parser import HTMLParser
        import json
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
        }
        
        resp = await client.get(url, headers=headers)
        html = resp.text
        
        if "validateCaptcha" in html or "captcha" in html.lower() or "automated access" in html.lower():
            LOGGER.info("O-ZEN: Amazon captcha detected. Retrying with mobile agent...")
            mobile_headers = {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "es-ES,es;q=0.9",
            }
            resp = await client.get(url, headers=mobile_headers)
            html = resp.text
            
            if "validateCaptcha" in html or "captcha" in html.lower():
                LOGGER.warning("O-ZEN: Amazon captcha bypass failed.")
                return None
                
        tree = HTMLParser(html)
        
        title_node = tree.css_first("#productTitle") or tree.css_first("#title")
        title = title_node.text().strip() if title_node else None
        
        if not title:
            return None
            
        price = None
        price_node = (
            tree.css_first(".apexPriceToPay .a-offscreen") or
            tree.css_first(".priceToPay .a-offscreen") or
            tree.css_first("#priceBlock_ourPrice") or
            tree.css_first(".a-price .a-offscreen") or
            tree.css_first("#priceblock_dealprice")
        )
        if price_node:
            price = price_node.text().strip()
        else:
            mobile_price = tree.css_first(".a-color-price") or tree.css_first("#price_inside_buybox")
            if mobile_price:
                price = mobile_price.text().strip()
                
        img_node = tree.css_first("#landingImage") or tree.css_first("#imgBlkFront") or tree.css_first("#main-image")
        image_url = None
        if img_node:
            dyn_img = img_node.attributes.get("data-a-dynamic-image")
            if dyn_img:
                try:
                    img_dict = json.loads(dyn_img)
                    image_url = list(img_dict.keys())[0]
                except Exception:
                    pass
            if not image_url:
                image_url = img_node.attributes.get("src")
                
        rating = None
        rating_node = (
            tree.css_first("#acrPopover span.a-icon-alt") or
            tree.css_first("#averageCustomerReviews span.a-icon-alt") or
            tree.css_first(".a-icon-star span.a-icon-alt")
        )
        if rating_node:
            rating = rating_node.text().strip()
            rating = re.sub(r'\s+de\s+\d+.*', ' / 5', rating)
            rating = re.sub(r'\s+out\s+of\s+\d+.*', ' / 5', rating)
            
        reviews = None
        reviews_node = tree.css_first("#acrCustomerReviewText")
        if reviews_node:
            reviews = reviews_node.text().strip()
            
        bullets = []
        for li in tree.css("#feature-bullets li span.a-list-item"):
            t = li.text().strip()
            if t and "patrocinado" not in t.lower():
                bullets.append(t)
                
        brand_node = tree.css_first("#bylineInfo") or tree.css_first("#brand")
        brand = brand_node.text().strip() if brand_node else None
        
        desc_node = tree.css_first("#productDescription")
        description = desc_node.text().strip() if desc_node else ""
        
        product_data = {
            "title": title,
            "price": price or "No disponible",
            "image": image_url,
            "rating": rating,
            "reviews": reviews,
            "bullets": bullets[:10],
            "description": description,
            "brand": brand,
            "site_name": "Amazon",
            "url": url
        }
        
        content_html = build_product_reader_html(product_data)
        
        return {
            "metadata": {
                "title": title,
                "author": brand or "Amazon",
                "date": "",
                "description": description[:160] if description else title,
                "image": image_url or "",
                "hero_image": image_url or "",
                "site_name": "Amazon",
                "url": url,
                "price": price or "No disponible",
                "rating": rating,
                "reviews": reviews
            },
            "content": content_html,
            "word_count": len((title + " " + (brand or "") + " " + description).split()) + 50,
            "status": "success",
            "render_method": "product_card"
        }
    except Exception as e:
        LOGGER.warning("Amazon product extraction failed: %s", e)
        return None


async def extract_mercadolibre_product(url: str, client) -> Optional[Dict]:
    """Extract Mercado Libre product details securely."""
    try:
        from selectolax.parser import HTMLParser
        
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9",
        }
        
        resp = await client.get(url, headers=headers)
        if resp.status_code != 200:
            LOGGER.warning("O-ZEN: Mercado Libre returned status %s for Googlebot UA", resp.status_code)
            return None
            
        tree = HTMLParser(resp.text)
        
        title_node = tree.css_first(".ui-pdp-title") or tree.css_first("h1")
        title = title_node.text().strip() if title_node else None
        
        if not title:
            return None
            
        price = None
        fraction_node = tree.css_first(".ui-pdp-price__part .andes-money-amount__fraction")
        symbol_node = tree.css_first(".ui-pdp-price__part .andes-money-amount__symbol")
        if fraction_node:
            sym = symbol_node.text().strip() if symbol_node else "$"
            price = f"{sym}{fraction_node.text().strip()}"
            
        img_node = (
            tree.css_first(".ui-pdp-gallery__figure__image") or
            tree.css_first(".ui-pdp-image") or
            tree.css_first(".ui-pdp-gallery .andes-carousel__element img")
        )
        image_url = None
        if img_node:
            image_url = img_node.attributes.get("data-zoom") or img_node.attributes.get("src")
            
        rating = None
        rating_node = tree.css_first(".ui-pdp-review__rating") or tree.css_first(".ui-review-capability__rating__number")
        if rating_node:
            rating = rating_node.text().strip() + " / 5"
            
        reviews = None
        reviews_node = tree.css_first(".ui-pdp-review__amount") or tree.css_first(".ui-review-capability__rating__label")
        if reviews_node:
            reviews = reviews_node.text().strip()
            
        desc_node = tree.css_first(".ui-pdp-description__content")
        description = desc_node.text().strip() if desc_node else ""
        
        brand_node = tree.css_first(".ui-pdp-seller__link-trigger") or tree.css_first(".ui-pdp-seller-validated")
        brand = brand_node.text().strip() if brand_node else None
        
        bullets = []
        for spec in tree.css(".ui-pdp-specs__table tr"):
            label = spec.css_first("th")
            value = spec.css_first("td")
            if label and value:
                bullets.append(f"<strong>{label.text().strip()}:</strong> {value.text().strip()}")
                
        if not bullets:
            for li in tree.css(".ui-pdp-features__list li"):
                t = li.text().strip()
                if t:
                    bullets.append(t)
                    
        product_data = {
            "title": title,
            "price": price or "No disponible",
            "image": image_url,
            "rating": rating,
            "reviews": reviews,
            "bullets": bullets[:10],
            "description": description,
            "brand": brand,
            "site_name": "Mercado Libre",
            "url": url
        }
        
        content_html = build_product_reader_html(product_data)
        
        return {
            "metadata": {
                "title": title,
                "author": brand or "Mercado Libre",
                "date": "",
                "description": description[:160] if description else title,
                "image": image_url or "",
                "hero_image": image_url or "",
                "site_name": "Mercado Libre",
                "url": url,
                "price": price or "No disponible",
                "rating": rating,
                "reviews": reviews
            },
            "content": content_html,
            "word_count": len((title + " " + (brand or "") + " " + description).split()) + 50,
            "status": "success",
            "render_method": "product_card"
        }
    except Exception as e:
        LOGGER.warning("Mercado Libre product extraction failed: %s", e)
        return None


async def extract_ebay_product(url: str, client) -> Optional[Dict]:
    """Extract eBay product page details."""
    try:
        from selectolax.parser import HTMLParser
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        }
        
        resp = await client.get(url, headers=headers)
        if resp.status_code != 200:
            LOGGER.warning("O-ZEN: eBay returned status %s", resp.status_code)
            return None
            
        tree = HTMLParser(resp.text)
        
        title_node = (
            tree.css_first(".x-item-title__mainTitle span") or
            tree.css_first("h1.it-ttl") or
            tree.css_first("h1#itemTitle")
        )
        title = None
        if title_node:
            title = title_node.text().strip()
            title = re.sub(r'^(Details about|Detalles sobre|Información sobre)\s+', '', title, flags=re.IGNORECASE)
            
        if not title:
            return None
            
        price = None
        price_node = (
            tree.css_first("span[itemprop='price']") or
            tree.css_first(".x-price-primary span") or
            tree.css_first("#prcIsum") or
            tree.css_first(".display-price")
        )
        if price_node:
            price = price_node.text().strip()
            
        currency_node = tree.css_first("span[itemprop='priceCurrency']")
        if currency_node and price:
            curr = currency_node.text().strip()
            if curr not in price:
                price = f"{curr} {price}"
                
        img_node = (
            tree.css_first(".ux-image-carousel-item img") or
            tree.css_first("img#icImg") or
            tree.css_first("img[itemprop='image']")
        )
        image_url = None
        if img_node:
            image_url = img_node.attributes.get("data-zoom") or img_node.attributes.get("src")
            
        rating = None
        rating_node = (
            tree.css_first("span[itemprop='ratingValue']") or
            tree.css_first("[itemprop='aggregateRating'] .average") or
            tree.css_first(".x-item-rating")
        )
        if rating_node:
            rating = rating_node.text().strip() + " / 5"
            
        reviews = None
        reviews_node = (
            tree.css_first("span[itemprop='reviewCount']") or
            tree.css_first(".x-item-rating-reviews")
        )
        if reviews_node:
            reviews = reviews_node.text().strip()
            
        bullets = []
        for spec in tree.css(".ux-layout-section--item-specifications .ux-labels-values"):
            labels = spec.css(".ux-labels-values__labels")
            values = spec.css(".ux-labels-values__values")
            for lbl, val in zip(labels, values):
                lbl_text = lbl.text().strip().rstrip(":")
                val_text = val.text().strip()
                if lbl_text and val_text:
                    bullets.append(f"<strong>{lbl_text}:</strong> {val_text}")
                    
        description = "Consultar descripción completa en el sitio original."
        desc_container = tree.css_first("#desc_div") or tree.css_first(".desc-wrapper")
        if desc_container:
            description = desc_container.text().strip()
            
        brand_node = tree.css_first(".mbg-nw") or tree.css_first(".ux-seller-section__name")
        brand = brand_node.text().strip() if brand_node else None
        
        product_data = {
            "title": title,
            "price": price or "No disponible",
            "image": image_url,
            "rating": rating,
            "reviews": reviews,
            "bullets": bullets[:10],
            "description": description,
            "brand": brand,
            "site_name": "eBay",
            "url": url
        }
        
        content_html = build_product_reader_html(product_data)
        
        return {
            "metadata": {
                "title": title,
                "author": brand or "eBay",
                "date": "",
                "description": description[:160],
                "image": image_url or "",
                "hero_image": image_url or "",
                "site_name": "eBay",
                "url": url,
                "price": price or "No disponible",
                "rating": rating,
                "reviews": reviews
            },
            "content": content_html,
            "word_count": len((title + " " + (brand or "") + " " + description).split()) + 50,
            "status": "success",
            "render_method": "product_card"
        }
    except Exception as e:
        LOGGER.warning("eBay product extraction failed: %s", e)
        return None


async def extract_site_specific(url: str, client) -> Optional[Dict]:
    """Determine site and route to the corresponding asynchronous site extractor."""
    if not url:
        return None
    domain = urlparse(url).netloc.lower()

    if "amazon." in domain and ("/dp/" in url or "/gp/product/" in url):
        return await extract_amazon_product(url, client)

    if "mercadolibre." in domain or "mercadolivre." in domain:
        if "/ML" in url or "/p/ML" in url:
            return await extract_mercadolibre_product(url, client)

    if "ebay." in domain and "/itm/" in url:
        return await extract_ebay_product(url, client)

    if "reddit.com" in domain and "/comments/" in url:
        return await extract_reddit(url, client)

    if ("youtube.com" in domain or "youtu.be" in domain) and ("watch" in url or "youtu.be" in domain):
        return await extract_youtube(url, client)

    if "msn.com" in domain and "/ar-" in url:
        return await extract_msn(url, client)

    return None


# ── HTTP Download with HTTP/1.1 Fallback WAF Bypass ─────────────────────────

async def fetch_with_fallback(url: str, client, timeout: float = 20.0) -> Optional[Tuple[str, int]]:
    """
    Downloads page using the provided httpx.AsyncClient (HTTP/2 enabled).
    If it gets blocked or fails with 403/429 (due to WAF fingerprinting/JA3),
    falls back to HTTP/1.1 client which bypasses Cloudflare challenge block.
    """
    import httpx
    
    # Try importing detect_block and gen_useragent from main utils
    try:
        from ..utils import gen_useragent, detect_block
    except ImportError:
        try:
            from utils import gen_useragent, detect_block
        except ImportError:
            def gen_useragent():
                return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            def detect_block(html, status_code, url_str):
                # Simple fallback
                if "just a moment..." in (html or "").lower() or "checking your browser" in (html or "").lower():
                    return True, "cloudflare"
                return False, ""

    try:
        client.headers["User-Agent"] = gen_useragent()
        resp = await client.get(url)
        
        is_blocked, block_reason = detect_block(resp.text, resp.status_code, "")
        if resp.status_code in (403, 429) or is_blocked:
            LOGGER.info(f"O-ZEN: HTTP/2 request failed/blocked (Status {resp.status_code}, Block: {block_reason}). Retrying with HTTP/1.1 fallback client...")
            async with httpx.AsyncClient(
                headers={
                    "User-Agent": gen_useragent(),
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3",
                },
                follow_redirects=True, timeout=timeout, http2=False, verify=False
            ) as fallback_client:
                fallback_resp = await fallback_client.get(url)
                return (fallback_resp.text, fallback_resp.status_code)
                
        return (resp.text, resp.status_code)
    except Exception as e:
        LOGGER.error(f"O-ZEN Fetch Error: {e}")
        return None


# ── Core Async Extraction Pipeline ──────────────────────────────────────────

async def resolve_google_news_url(url: str, client) -> Optional[str]:
    """
    Resolves an obfuscated Google News RSS article URL to the original source URL.
    """
    try:
        from lxml.html import fromstring as html_fromstring
        
        # 1. Fetch the intermediate page to get the necessary parameters
        resp = await client.get(url)
        if resp.status_code != 200:
            return None
            
        tree = html_fromstring(resp.text)
        
        # Find c-wiz with data-p (Google's custom element containing the payload)
        cwiz = tree.xpath("//c-wiz[@data-p] | //div[@data-p]")
        if not cwiz:
            return None
            
        data_p = cwiz[0].get("data-p")
        if not data_p:
            return None
            
        # Parse and format the object
        replaced = data_p.replace('%.@.', '["garturlreq",')
        obj = json.loads(replaced)
        
        # Prepare the payload for the Fbv4je RPC
        req_data = obj[:-6] + obj[-2:]
        payload = {
            'f.req': json.dumps([[["Fbv4je", json.dumps(req_data), "null", "generic"]]])
        }
        
        # POST to the batchexecute endpoint
        post_url = "https://news.google.com/_/DotsSplashUi/data/batchexecute"
        post_resp = await client.post(
            post_url,
            headers={'content-type': 'application/x-www-form-urlencoded;charset=UTF-8'},
            data=payload
        )
        
        if post_resp.status_code != 200:
            return None
            
        # Parse the response to extract the actual URL
        clean_text = post_resp.text.replace(")]}'\n", "")
        res_array = json.loads(clean_text)
        nested_json = res_array[0][2]
        final_url = json.loads(nested_json)[1]
        return final_url
    except Exception as e:
        LOGGER.warning("Error resolving Google News URL: %s", e)
        return None


async def extract_url(url: str, client, timeout: float = 20.0) -> Dict[str, Any]:
    """
    Executes the complete core async extraction pipeline for a given URL.
    This resides inside the ozen_engine package.
    """
    from urllib.parse import urlparse, quote_plus
    import re

    # If the URL is a Google News RSS article redirect, resolve it to the real target URL first
    if "news.google.com" in urlparse(url).netloc.lower() and "/rss/articles/" in url:
        real_url = await resolve_google_news_url(url, client)
        if real_url:
            LOGGER.info(f"O-ZEN: Resolved Google News URL to: {real_url}")
            url = real_url
    
    # Try importing detect_block and gen_useragent
    try:
        from ..utils import gen_useragent, detect_block
    except ImportError:
        try:
            from utils import gen_useragent, detect_block
        except ImportError:
            def gen_useragent():
                return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            def detect_block(html, status_code, url_str):
                if "just a moment..." in (html or "").lower() or "checking your browser" in (html or "").lower():
                    return True, "cloudflare"
                return False, ""

    # 1. Site-specific extraction (Reddit, YouTube, MSN)
    site_result = await extract_site_specific(url, client)
    if site_result:
        if site_result.get("word_count", 0) > 0 or "error" in site_result or (site_result.get("status") and (site_result.get("status").startswith("http_") or site_result.get("status").startswith("blocked_"))):
            return site_result

    # 2. Fetch HTML using fallback mechanism
    fetch_result = await fetch_with_fallback(url, client, timeout)
    if not fetch_result:
        return {"error": "Fallo de conexión. No se pudo acceder al sitio de destino."}

    html, status_code = fetch_result
    domain = urlparse(url).netloc

    # 3. HTTP error handling
    if status_code in [403, 429, 503]:
        msgs = {
            403: f"Acceso denegado (403). El sitio {domain} ha rechazado la petición.",
            429: f"Demasiadas solicitudes (429). Intenta de nuevo más tarde.",
            503: f"Servicio no disponible (503). El sitio {domain} no está disponible.",
        }
        return {
            "metadata": {"title": f"Error {status_code} — {domain}", "site_name": domain, "url": url},
            "content": f"<div class='error-notice'><h3>⚠️ Error HTTP {status_code}</h3><p>{msgs.get(status_code, '')}</p><p><a href='{url}' target='_blank'>{url}</a></p></div>",
            "word_count": 0, "status": f"http_{status_code}"
        }

    # 4. Block/WAF detection
    is_blocked, block_reason = detect_block(html, status_code, "")
    if is_blocked:
        return {
            "metadata": {"title": f"Acceso bloqueado — {domain}", "site_name": domain, "url": url},
            "content": f"<div class='block-notice'><h3>⚠️ Contenido no disponible</h3><p>El sitio {domain} está bloqueando el acceso ({block_reason}).</p><p><a href='{url}' target='_blank'>{url}</a></p></div>",
            "word_count": 0, "status": f"blocked_{block_reason}", "block_reason": block_reason
        }

    # 5. Core O-ZEN extraction
    from .core import bare_extraction, extract as ozen_extract, baseline as ozen_baseline
    from .baseline import extract_jsonld_content

    try:
        doc = bare_extraction(
            html, url=url, include_comments=False, include_tables=True,
            include_images=True, include_formatting=True,
            output_format="python", with_metadata=True
        )

        # Check if it's a liveblog
        jsonld_res = extract_jsonld_content(html)
        if jsonld_res and jsonld_res.get("type") == "liveblog" and jsonld_res.get("content"):
            rich_content = extract_nextjs_liveblog(html)
            if not rich_content:
                rich_content = extract_milenio_liveblog(html, url)
            
            if rich_content:
                content_html = rich_content
                word_count = len(re.sub(r'<[^>]*>', ' ', content_html).split())
            else:
                updates = jsonld_res["content"].split("\n\n")
                content_html = ""
                for u in updates:
                    u_trimmed = u.strip()
                    if u_trimmed:
                        parts = u_trimmed.split("\n")
                        headline = parts[0]
                        body = "\n".join(parts[1:])
                        content_html += f"<div class='liveblog-update'><h3>{headline}</h3>"
                        for p in body.split("\n"):
                            p_trimmed = p.strip()
                            if p_trimmed:
                                content_html += f"<p>{p_trimmed}</p>"
                        content_html += "</div>"
                word_count = len(jsonld_res["content"].split())

            hero_image = (doc.image or "").strip() if doc else (jsonld_res.get("image") or "")
            
            return {
                "metadata": {
                    "title": (doc.title if doc else None) or jsonld_res.get("title") or "Cobertura en vivo",
                    "author": (doc.author if doc else None) or "",
                    "date": (doc.date if doc else None) or "",
                    "description": (doc.description if doc else None) or jsonld_res.get("description") or "",
                    "image": (doc.image if doc else None) or jsonld_res.get("image") or "",
                    "hero_image": hero_image,
                    "site_name": (doc.sitename if doc else None) or urlparse(url).netloc,
                    "url": (doc.url if doc else None) or url
                },
                "content": content_html,
                "word_count": word_count,
                "status": "success (liveblog jsonld)"
            }

        # Handle normal pages
        if not doc or not doc.text:
            _, text, _ = ozen_baseline(html)
            if text and len(text) > 100:
                return {
                    "metadata": {"title": url, "site_name": urlparse(url).netloc},
                    "content": f"<p>{text}</p>",
                    "word_count": len(text.split()),
                    "status": "success (baseline)"
                }
            return {"error": "No se pudo extraer contenido valioso de la página."}

        content_html = ozen_extract(
            html, url=url, output_format="html",
            include_comments=False, include_images=True, include_tables=True
        )

        # Post-process content html
        content_html = clean_ad_placeholders(content_html)
        content_html = inject_missing_images(content_html, html, url)
        content_html = inject_missing_embeds(content_html, html, url)

        hero_image = (doc.image or "").strip()
        if hero_image and quote_plus(hero_image) in (content_html or ""):
            hero_image = ""

        return {
            "metadata": {
                "title": doc.title or "Sin título",
                "author": doc.author or "",
                "date": doc.date or "",
                "description": doc.description or "",
                "image": doc.image or "",
                "hero_image": hero_image,
                "site_name": doc.sitename or urlparse(url).netloc,
                "url": doc.url or url
            },
            "content": content_html,
            "word_count": len((doc.text or "").split()),
            "status": "success"
        }
    except Exception as e:
        LOGGER.error(f"Error en O-ZEN Engine: {e}")
        return {"error": f"Error en O-ZEN Engine: {e}"}