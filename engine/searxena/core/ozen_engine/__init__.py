"""
Python & command-line tool to gather text on the Web:
web crawling/scraping, extraction of text, metadata, comments.
"""

__title__ = "O-ZEN"
__author__ = "Adrien Barbaresi and contributors"
__license__ = "Apache-2.0"
__copyright__ = "Copyright 2019-present, Adrien Barbaresi"
__version__ = "2.1.0"


import logging

from .baseline import (
    baseline,
    html2txt,
    extract_jsonld_content,
    extract_next_data,
    extract_noscript_content,
    extract_extended_meta,
    extract_heuristic_density,
)
from .core import bare_extraction, extract, extract_with_metadata
from .downloads import fetch_response, fetch_url
from .metadata import extract_metadata
from .site_extractors import (
    detect_reddit_challenge,
    solve_reddit_challenge,
    extract_reddit_post,
    reddit_markdown_to_html,
    build_reddit_reader_html,
    extract_youtube_video_id,
    build_youtube_oembed_url,
    build_youtube_reader_html,
    extract_msn_article_id,
    extract_msn_locale,
    build_msn_api_url,
    process_msn_body,
    extract_milenio_liveblog,
    inject_missing_embeds,
    extract_nextjs_liveblog,
    extract_url,
)
from .utils import load_html

logging.getLogger(__name__).addHandler(logging.NullHandler())

__all__ = [
    "bare_extraction",
    "baseline",
    "extract",
    "extract_metadata",
    "extract_with_metadata",
    "fetch_response",
    "fetch_url",
    "html2txt",
    "load_html",
    # Native enhancement functions
    "extract_jsonld_content",
    "extract_next_data",
    "extract_noscript_content",
    "extract_extended_meta",
    "extract_heuristic_density",
    # Site-specific extractors
    "detect_reddit_challenge",
    "solve_reddit_challenge",
    "extract_reddit_post",
    "reddit_markdown_to_html",
    "build_reddit_reader_html",
    "extract_youtube_video_id",
    "build_youtube_oembed_url",
    "build_youtube_reader_html",
    "extract_msn_article_id",
    "extract_msn_locale",
    "build_msn_api_url",
    "process_msn_body",
    "extract_milenio_liveblog",
    "inject_missing_embeds",
    "extract_nextjs_liveblog",
    "extract_url",
]