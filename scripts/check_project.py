"""Offline parser and live-entry dependency checks; no build dependencies."""
from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[1]

class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and attrs.get("src"):
            self.paths.append(attrs["src"])
        if tag == "link" and attrs.get("rel") == "stylesheet" and attrs.get("href"):
            self.paths.append(attrs["href"])


def resolve_local(parent, value):
    url = urlsplit(value)
    if url.scheme or url.netloc:
        return None
    target = (ROOT / unquote(url.path).lstrip("/")) if url.path.startswith("/") else (parent / unquote(url.path))
    target = target.resolve()
    if not target.is_relative_to(ROOT) or not target.is_file():
        raise ValueError(f"Missing or out-of-root resource: {value}")
    return target


def main():
    files = sorted(ROOT.glob("*.js")) + sorted((ROOT / "src").rglob("*.js"))
    for path in files:
        result = subprocess.run(["node", "--input-type=module", "--check"], input=path.read_text(), text=True, capture_output=True)
        if result.returncode:
            raise ValueError(f"{path.relative_to(ROOT)}: {result.stderr}")
    assets = Assets()
    assets.feed((ROOT / "index.html").read_text())
    pending = [p for value in assets.paths if (p := resolve_local(ROOT, value)) is not None]
    visited = set()
    # Static imports used by the current vanilla ESM project; not a general JS parser.
    imports = re.compile(r"^\s*import\s+(?:[^;]*?\s+from\s+)?[\"']([^\"']+)[\"']", re.MULTILINE)
    while pending:
        path = pending.pop()
        if path in visited:
            continue
        visited.add(path)
        if path.suffix == ".js":
            for value in imports.findall(path.read_text()):
                if (target := resolve_local(path.parent, value)) is not None:
                    pending.append(target)
    print(f"PASS: Node parsed {len(files)} JS files; {len(visited)} live local assets/imports resolve.")
    for path in sorted(visited):
        print(f"  {path.relative_to(ROOT)}")

if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
