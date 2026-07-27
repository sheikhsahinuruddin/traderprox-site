"""
Regenerates /sitemap.xml by scanning the site directory for pages.
Run this after adding/removing any page (e.g. a new /articles/*.html file)
to keep sitemap.xml automatically in sync — this fulfills the "automatically
include all new pages" requirement without needing to hand-edit the XML.

Usage:  python3 generate_sitemap.py
"""
import os
import datetime
import glob
import xml.sax.saxutils as sax

SITE_ROOT = os.path.dirname(os.path.abspath(__file__))
BASE_URL = "https://traderprox.site"
TODAY = "2026-07-27"  # update when regenerating, or replace with datetime.date.today().isoformat()

# Each entry: (path relative to site root, changefreq, priority)
STATIC_PAGES = [
    ("index.html", "weekly", "1.0"),
    ("articles/index.html", "weekly", "0.8"),
]

def discover_articles():
    """Any .html file directly under /articles/ except the hub index itself."""
    pages = []
    for fp in sorted(glob.glob(os.path.join(SITE_ROOT, "articles", "*.html"))):
        name = os.path.basename(fp)
        if name == "index.html":
            continue
        pages.append((f"articles/{name}", "monthly", "0.7"))
    return pages


def to_url(rel_path):
    """Convert a relative file path to a clean absolute URL.
    index.html at the root maps to the domain root; index.html inside a
    folder maps to that folder's trailing-slash URL (avoids duplicate-
    content issues between /articles/ and /articles/index.html)."""
    if rel_path == "index.html":
        return f"{BASE_URL}/"
    if rel_path.endswith("/index.html"):
        folder = rel_path[: -len("index.html")]
        return f"{BASE_URL}/{folder}"
    return f"{BASE_URL}/{rel_path}"


def build_sitemap():
    entries = STATIC_PAGES + discover_articles()
    # de-duplicate on final URL, preserving order
    seen = set()
    lines = ['<?xml version="1.0" encoding="UTF-8"?>']
    lines.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    for rel_path, changefreq, priority in entries:
        url = to_url(rel_path)
        if url in seen:
            continue
        seen.add(url)
        loc = sax.escape(url)
        lines.append("  <url>")
        lines.append(f"    <loc>{loc}</loc>")
        lines.append(f"    <lastmod>{TODAY}</lastmod>")
        lines.append(f"    <changefreq>{changefreq}</changefreq>")
        lines.append(f"    <priority>{priority}</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    xml_content = build_sitemap()
    out_path = os.path.join(SITE_ROOT, "sitemap.xml")
    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(xml_content)
    url_count = xml_content.count("<loc>")
    print(f"Wrote {out_path} with {url_count} URLs")
