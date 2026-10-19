"""Builds docs/AI_INTAKE_BUILD_GUIDE.md from guide.template.md, pasting in the current source files.
Run from the repo root: python3 scripts/build-ai-intake-guide/build.py"""
import datetime, json, re, subprocess, sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
tpl = (Path(__file__).parent / "guide.template.md").read_text()
pkg = json.loads((root / "package.json").read_text())
deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}

def read(rel):
    return (root / rel).read_text().rstrip("\n")

def snippet(m):
    rel, start, end = m.group(1), m.group(2), m.group(3)
    text = read(rel)
    i = text.index(start)
    j = text.index(end, i + len(start))
    return text[i:j].rstrip("\n")

out = tpl
out = re.sub(r"\{\{SNIPPET:([^|}]+)\|([^|}]+)\|([^}]+)\}\}", snippet, out)
out = re.sub(r"\{\{FILE:([^}]+)\}\}", lambda m: read(m.group(1)), out)
out = re.sub(r"\{\{V:([^}]+)\}\}", lambda m: deps[m.group(1)].lstrip("^~"), out)
out = out.replace("{{DATE}}", datetime.date.today().isoformat())
commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=root, capture_output=True, text=True).stdout.strip()
out = out.replace("{{COMMIT}}", commit or "unknown")
left = re.search(r"\{\{(FILE|SNIPPET|V|DATE|COMMIT)\b[^}]*\}\}", out)
if left:
    sys.exit("Unfilled placeholder: " + left.group(0))
(root / "docs" / "AI_INTAKE_BUILD_GUIDE.md").write_text(out + "\n")
print("wrote docs/AI_INTAKE_BUILD_GUIDE.md", len(out.splitlines()), "lines")
