"""Run CE locally/CI; print locations and rule IDs, never matched source/values.

No application imports, builds or dependency installation. All ERROR rules in the
reviewed local policy block CI; WARNING findings remain visible for review.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from html.parser import HTMLParser


GENERATED = {
    "node_modules", ".git", ".nuxt", ".output", "dist", "coverage",
    ".cache", ".pnpm-store", "output", "artifacts",
}


class VueScripts(HTMLParser):
    """Extract SFC script bodies as data, preserving original source line numbers."""
    def __init__(self, source):
        super().__init__(convert_charrefs=False)
        self.source = source
        self.lines = source.splitlines(keepends=True)
        self.active = None
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        if tag != "script":
            return
        attrs = dict(attrs)
        if "src" in attrs:
            return  # External JS/TS is scanned in its original file.
        lang = attrs.get("lang", "js").lower()
        if lang not in {"js", "javascript", "ts", "typescript", "jsx", "tsx"}:
            raise ValueError("Unsupported SFC script language")
        line, col = self.getpos()
        start = sum(map(len, self.lines[:line - 1])) + col + len(self.get_starttag_text())
        self.active = (start, "ts" if lang in {"ts", "typescript", "tsx"} else "js")

    def handle_endtag(self, tag):
        if tag != "script" or self.active is None:
            return
        line, col = self.getpos()
        end = sum(map(len, self.lines[:line - 1])) + col
        start, language = self.active
        self.scripts.append(("\n" * self.source[:start].count("\n") + self.source[start:end], language))
        self.active = None


def extract_vue(root, destination):
    source_paths = {}
    for folder, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in GENERATED and not d.startswith(".nuxt-")]
        for name in sorted(files):
            if not name.endswith(".vue"):
                continue
            path = Path(folder) / name
            parser = VueScripts(path.read_text(encoding="utf-8-sig"))
            parser.feed(parser.source)
            parser.close()
            if parser.active is not None:
                raise ValueError("Unclosed SFC script")
            for index, (body, language) in enumerate(parser.scripts):
                relative = path.relative_to(root)
                target = destination / (str(relative) + f".script{index}.{language}")
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(body, encoding="utf-8")
                source_paths[str(target.resolve())] = relative.as_posix()
    return source_paths


def scan(target, policy, mapping):
    executable = shutil.which("semgrep")
    if not executable:
        print("Semgrep executable missing; install the pinned version.")
        return 2
    command = [executable, "scan", "--oss-only", "--config", str(policy),
               "--metrics=off", "--disable-version-check", "--disable-nosem",
               "--strict", "--no-git-ignore", "--json", "--quiet", str(target)]
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            encoding="utf-8", errors="replace", check=False)
    try:
        data = json.loads(result.stdout)
    except (ValueError, TypeError):
        print(f"Semgrep did not return valid JSON (exit {result.returncode}); scan failed.")
        return 2
    blocked = 0
    for finding in data.get("results", []):
        path = finding["path"]
        source = mapping.get(str(Path(path).resolve()), path)
        severity = finding.get("extra", {}).get("severity", "UNKNOWN")
        blocked += severity == "ERROR"
        # JSON quoting neutralizes terminal control characters and workflow command syntax.
        print(json.dumps({"rule": finding["check_id"], "severity": severity,
                          "path": source, "line": finding["start"]["line"]}, ensure_ascii=True))
    errors = data.get("errors", [])
    for error in errors:
        print(json.dumps({"scanner_error_type": (error.get("type", ["unknown"])[0] if isinstance(error.get("type"), list) else error.get("type", "unknown"))}, ensure_ascii=True))
    print(f"Semgrep: {len(data.get('results', []))} findings, {blocked} blocking, "
          f"{len(data.get('paths', {}).get('scanned', []))} files scanned.")
    if result.returncode or errors:
        print("Incomplete/failed scan; errors are not suppressed.")
        return 2
    return 1 if blocked else 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--vue-scripts", action="store_true")
    args = parser.parse_args()
    root = Path.cwd().resolve()
    policy = root / ".github/security/semgrep.yml"
    status = scan(root, policy, {})
    if args.vue_scripts:
        try:
            with tempfile.TemporaryDirectory(prefix="apartha-vue-sast-") as folder:
                mapping = extract_vue(root, Path(folder))
                print(f"Vue: extracted {len(mapping)} script blocks; templates use generic rules only.")
                if mapping:
                    status = max(status, scan(Path(folder), policy, mapping))
        except (ValueError, OSError):
            print("Vue extraction failed; analysis is incomplete.")
            return 2
    return status


if __name__ == "__main__":
    raise SystemExit(main())
