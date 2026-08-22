import html
import io
import json
import re
import sys


# Force UTF-8 encoding for standard output so captions remain intact on Windows.
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


def clean_subtitle_text(subtitle_content):
    """Remove common WebVTT/SRT markup and duplicate caption lines."""
    text = re.sub(r"<[^>]+>", "", subtitle_content)
    cleaned_lines = []

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("WEBVTT") or "-->" in line:
            continue
        if re.match(r"^\d+$", line):
            continue
        if re.match(r"^(Kind|Language|Style|Note|Language-Code|Query):", line, re.IGNORECASE):
            continue
        if cleaned_lines and cleaned_lines[-1] == line:
            continue
        cleaned_lines.append(line)

    return " ".join(cleaned_lines)


def extract_youtube_video_id(url):
    """Extract the 11-character video ID from common YouTube URLs."""
    if not url:
        return None

    pattern = (
        r"(?:https?://)?(?:www\.|m\.)?"
        r"(?:youtube\.com/(?:[^/\n\s]+/\S+/|(?:v|e(?:mbed)?)/|\S*?[?&]v=)|"
        r"youtu\.be/|youtube\.com/shorts/)([a-zA-Z0-9_-]{11})"
    )
    match = re.search(pattern, url)
    return match.group(1) if match else None


def fetch_youtube_transcript_api(video_id, lang_override="auto"):
    """Fetch captions exposed by YouTube; never downloads audio or transcribes locally."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi

        api = YouTubeTranscriptApi()
        transcript_list = api.list(video_id)
        available_langs = [t.language_code for t in transcript_list]

        if lang_override == "auto":
            if "es" in available_langs:
                transcript = transcript_list.find_transcript(["es"])
            elif "en" in available_langs:
                transcript = transcript_list.find_transcript(["en"])
            else:
                transcript = next(iter(transcript_list))
        else:
            transcript = transcript_list.find_transcript([lang_override])

        detected_lang = transcript.language_code
        data = transcript.fetch()
        raw_text = "\n".join(
            item.text if hasattr(item, "text") else item.get("text", "")
            for item in data
        )
        transcription = clean_subtitle_text(html.unescape(raw_text))
        if not transcription.strip():
            return None

        return {
            "success": True,
            "title": "YouTube captions",
            "duration": 0,
            "language_detected": detected_lang,
            "language_used": detected_lang,
            "transcription": transcription,
        }
    except Exception:
        return None


def no_captions_response(url):
    """Return a friendly, explicit response when captions are unavailable."""
    message = (
        "No hay captions o subtítulos disponibles para este video. "
        "No se descargó audio ni se realizó una transcripción local."
    )
    return {"success": False, "url": url, "error": message, "message": message}


def main():
    try:
        if len(sys.argv) <= 1:
            print(json.dumps({"success": False, "error": "No arguments provided. URL is required."}))
            return

        try:
            args = json.loads(sys.argv[1])
        except Exception as parse_error:
            print(json.dumps({"success": False, "error": f"Failed to parse arguments JSON: {parse_error}"}))
            return

        url = args.get("url")
        lang_override = str(args.get("language", "auto") or "auto").lower()
        if not url:
            print(json.dumps({"success": False, "error": "Missing required parameter: 'url'"}))
            return

        video_id = extract_youtube_video_id(url)
        if not video_id:
            print(json.dumps(no_captions_response(url), ensure_ascii=False))
            return

        result = fetch_youtube_transcript_api(video_id, lang_override)
        print(
            json.dumps(
                result if result else no_captions_response(url),
                ensure_ascii=False,
            )
        )
    except Exception as global_error:
        print(json.dumps({"success": False, "error": f"Unexpected error: {global_error}"}))


if __name__ == "__main__":
    main()
