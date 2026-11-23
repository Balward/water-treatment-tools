"""Rebuild the page search index from the supplied edition (pypdf and pypdfium2)."""
import json
import re
from pathlib import Path

import pypdfium2 as pdfium
from pypdf import PdfReader

root = Path(__file__).resolve().parents[1] / "apps" / "instrumentation"
source = root / "lessons.pdf"
reader = PdfReader(source)
chapters = []
for entry in reader.outline:
    if isinstance(entry, list):
        for topic in entry:
            if not isinstance(topic, list):
                chapters[-1]["topics"].append([topic.title.replace("\ufffd", "-"), reader.get_destination_page_number(topic) + 1])
    else:
        chapters.append(dict(title=entry.title.replace("\ufffd", "-"), page=reader.get_destination_page_number(entry) + 1, topics=[]))

def save(name, value):
    (root / name).write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

save("chapters.json", chapters)
pages = []
with pdfium.PdfDocument(source) as document:
    for page in document:
        text = page.get_textpage()
        try:
            passage = text.get_text_bounded().replace("\u00ad", "")
            pages.append(re.sub(r"\s+", " ", passage).strip())
        finally:
            text.close()
            page.close()
save("pages.json", pages)
