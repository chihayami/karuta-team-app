#!/usr/bin/env python3
"""Check this repository's Markdown links, anchors and specification IDs."""

import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
KINDS = "TBL|RET|SCR|DEC|POC|TST|ETE|NAV|VAL|BND|MIL|IMP|API"
AREAS = {"SYS", "AUT", "PTL", "RST", "PRC", "TEN", "TOP", "ACC", "ENV", "OPS"}
ID = re.compile(rf"(?<![A-Za-z0-9])(?:{KINDS})-[A-Z]{{3}}-\d{{2}}(?![A-Za-z0-9])")
OLD = re.compile(rf"(?<![A-Za-z0-9])(?:{KINDS})\d{{2}}-\d{{2}}(?![A-Za-z0-9])", re.I)
ANCHOR = re.compile(r'<a\s+id="([^"]+)"\s*></a>')
LINK = re.compile(r"\[[^\]\n]*\]\(([^)\n]+)\)")


def slug(title):
    title = re.sub(r"<[^>]*>", "", title).strip().lower()
    return "".join(
        char for char in title
        if char in "-_ " or unicodedata.category(char)[0] in "LN" or char == "\u200d"
    ).replace(" ", "-")


def anchors(text):
    result = ANCHOR.findall(text)
    used = set()
    for title in re.findall(r"^#{1,6}\s+(.+?)\s*#*\s*$", text, re.M):
        base = slug(title)
        value, suffix = base, 0
        while value in used:
            suffix += 1
            value = f"{base}-{suffix}"
        used.add(value)
        result.append(value)
    return result


def main():
    files = sorted(p for directory in ("documents", "app", "contracts", "tests")
                   for p in (ROOT / directory).rglob("*.md"))
    if (ROOT / "README.md").exists():
        files.append(ROOT / "README.md")
    contents = {p.resolve(): p.read_text() for p in files}
    definitions, errors, anchor_sets = {}, [], {}
    for path, text in contents.items():
        relative = path.relative_to(ROOT)
        all_anchors = anchors(text)
        for value, count in Counter(all_anchors).items():
            if count > 1:
                errors.append(f"{relative}: duplicate anchor {value}")
        anchor_sets[path] = set(all_anchors)
        if "history" in relative.parts:
            continue
        for value in ANCHOR.findall(text):
            key = value.upper()
            if not ID.fullmatch(key):
                continue
            if value != key.lower() or key.split("-")[1] not in AREAS or key.endswith("-00"):
                errors.append(f"{relative}: invalid ID anchor {value}")
            if key in definitions:
                errors.append(f"{relative}: duplicate ID {key}")
            definitions[key] = path
        if relative != Path("documents/id-migration.md") and OLD.search(text):
            errors.append(f"{relative}: legacy ID {OLD.search(text)[0]}")
        if "\u3000" in text:
            errors.append(f"{relative}: full-width space")

    local_links = 0
    for path, text in contents.items():
        relative = path.relative_to(ROOT)
        if "history" not in relative.parts:
            for key in set(ID.findall(text)):
                if key not in definitions:
                    errors.append(f"{relative}: undefined ID {key}")
        for target in LINK.findall(text):
            target = target.strip().strip("<>")
            parts = urlsplit(target)
            if parts.scheme or parts.netloc:
                continue
            local_links += 1
            linked = (path.parent / unquote(parts.path)).resolve() if parts.path else path
            if not linked.exists():
                errors.append(f"{relative}: missing file {target}")
                continue
            if parts.fragment and linked.suffix == ".md":
                if linked not in anchor_sets:
                    anchor_sets[linked] = set(anchors(linked.read_text()))
                if unquote(parts.fragment) not in anchor_sets[linked]:
                    errors.append(f"{relative}: missing anchor {target}")

    for error in errors:
        print(error, file=sys.stderr)
    print(f"Checked {len(files)} documents, {len(definitions)} IDs, "
          f"{local_links} local links: {len(errors)} errors.")
    return bool(errors)


if __name__ == "__main__":
    sys.exit(main())
