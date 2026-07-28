"""Point promoted Korean chapter pages back to their real source files."""

import re
from urllib.parse import urlsplit, urlunsplit


_PROMOTED_CHAPTER = re.compile(r"^book/chapter(?:[1-9]|10)/index\.md$")


def _original_source_uri(src_uri: str) -> str | None:
    if not _PROMOTED_CHAPTER.fullmatch(src_uri):
        return None
    return src_uri.removesuffix("/index.md") + ".md"


def on_page_context(context, page, **kwargs):
    """Rewrite edit/view links for the ten chapter files promoted at build time."""

    src_uri = getattr(getattr(page, "file", None), "src_uri", "")
    original_uri = _original_source_uri(src_uri)
    edit_url = getattr(page, "edit_url", None)
    if original_uri is None or not edit_url:
        return context

    url = urlsplit(edit_url)
    if url.path.endswith(src_uri):
        source_path = url.path[: -len(src_uri)] + original_uri
        page.edit_url = urlunsplit(url._replace(path=source_path))

    return context
