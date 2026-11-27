#!/usr/bin/env python3
"""Esegue app-attivita/tests/index.html in Chrome headless, senza dipendenze Python."""
from __future__ import annotations

import functools
import html
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

APP_DIR = pathlib.Path(__file__).resolve().parents[2] / "app-attivita"
TEST_PAGE = "/tests/index.html"
TIMEOUT_SECONDS = 60
# Minimo di test frontend atteso: alzarlo quando vengono aggiunti nuovi test.
# Se scende, probabilmente un file di test non è stato caricato o è stato rimosso.
MIN_EXPECTED_TESTS = 369


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        pass


def find_chrome() -> str:
    for candidate in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        executable = shutil.which(candidate)
        if executable:
            return executable
    raise RuntimeError("Chrome/Chromium non trovato nel runner GitHub Actions")


def check_versions() -> str | None:
    """La versione della pagina (js/update.js) e quella della cache (sw.js) devono essere la stessa."""
    patterns = {
        "sw.js": (APP_DIR / "sw.js", r"^const CACHE_VERSION = '([^']+)';"),
        "js/update.js": (APP_DIR / "js" / "update.js", r"^\s*const VERSION = '([^']+)';"),
    }
    found = {}
    for name, (path, pattern) in patterns.items():
        match = re.search(pattern, path.read_text(encoding="utf-8"), re.MULTILINE)
        if not match:
            return f"Versione non trovata in {name}"
        found[name] = match.group(1)
    if found["sw.js"] != found["js/update.js"]:
        return (
            f"CACHE_VERSION di sw.js ({found['sw.js']}) e VERSION di js/update.js ({found['js/update.js']}) "
            "devono essere uguali: si cambiano insieme."
        )
    return None


def check_font_sizes() -> str | None:
    """«Dimensione testo»: in css/style.css le misure del testo in px (in font-size, dentro font e nelle variabili
    che finiscono così, come --titolo-font-size) passano da --px (o --px-ui), così crescono con il testo scelto
    sull'iPhone. Un px fisso voluto (emoji nei riquadri fissi, barra delle schede) dice perché, con il commento
    «px fisso: …» su una riga della dichiarazione.
    Una dichiarazione può andare a capo; il testo dei commenti non conta, a parte «px fisso»."""
    css = (APP_DIR / "css" / "style.css").read_text(encoding="utf-8")
    lines = css.split("\n")
    # I commenti diventano spazi e i loro a capo restano: posizioni e numeri di riga sono quelli del file
    code = re.sub(r"/\*.*?\*/", lambda comment: re.sub(r"[^\n]", " ", comment.group(0)), css, flags=re.DOTALL)
    fixed = []
    for match in re.finditer(r"((?:--[-\w]*)?font(?:-size)?)\s*:\s*([^;{}]+)", code):
        prop, value = match.group(1), " ".join(match.group(2).split())
        if "px" not in value or "var(--px" in value:
            continue
        first = code.count("\n", 0, match.start()) + 1
        last = code.count("\n", 0, match.end()) + 1
        if any("px fisso" in lines[number - 1] for number in range(first, last + 1)):
            continue
        fixed.append(f"  riga {first}: {prop}: {value}")
    if fixed:
        return (
            "In css/style.css le misure del testo (in font-size, dentro font e nelle variabili che finiscono così) si "
            "scrivono calc(N * var(--px)), dove N è la misura in px con il testo normale, così seguono «Dimensione "
            "testo» dell'iPhone. Un px fisso voluto porta il commento «px fisso: perché» su una riga della "
            "dichiarazione. Da sistemare:\n" + "\n".join(fixed)
        )
    return None


def main() -> int:
    if not (APP_DIR / "tests" / "index.html").is_file():
        print(f"Pagina di test non trovata: {APP_DIR / 'tests' / 'index.html'}", file=sys.stderr)
        return 1

    for problem in (check_versions(), check_font_sizes()):
        if problem:
            print(problem, file=sys.stderr)
            return 1

    try:
        chrome = find_chrome()
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        return 1

    version_result = subprocess.run([chrome, "--version"], check=True, capture_output=True, text=True)
    chrome_version = version_result.stdout.strip()

    handler = functools.partial(QuietHandler, directory=str(APP_DIR))
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        server_thread = threading.Thread(target=server.serve_forever, daemon=True)
        server_thread.start()
        url = f"http://127.0.0.1:{server.server_address[1]}{TEST_PAGE}"
        profile_dir = tempfile.mkdtemp(prefix="aura-tasks-chrome-")
        command = [
            chrome,
            "--headless=new",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--disable-background-networking",
            "--disable-extensions",
            "--no-first-run",
            "--no-default-browser-check",
            f"--user-data-dir={profile_dir}",
            "--dump-dom",
            url,
        ]
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=TIMEOUT_SECONDS, check=False)
        except subprocess.TimeoutExpired:
            print(f"Chrome non ha completato i test entro {TIMEOUT_SECONDS} secondi", file=sys.stderr)
            return 1
        finally:
            server.shutdown()
            server_thread.join(timeout=5)
            shutil.rmtree(profile_dir, ignore_errors=True)

    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        print(result.stdout)
        return result.returncode or 1

    title_match = re.search(r"<title>(.*?)</title>", result.stdout, re.IGNORECASE | re.DOTALL)
    summary_match = re.search(r'<p[^>]*id="summary"[^>]*>(.*?)</p>', result.stdout, re.IGNORECASE | re.DOTALL)
    title = html.unescape(title_match.group(1)).strip() if title_match else ""
    summary = html.unescape(re.sub(r"<[^>]+>", "", summary_match.group(1))).strip() if summary_match else ""

    summary_match = re.fullmatch(r"Tutti i (?P<count>[0-9]+) test superati", summary)
    if not title.startswith("PASS") or not summary_match:
        print(f"Esito browser inatteso: titolo={title!r}, riepilogo={summary!r}", file=sys.stderr)
        print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        return 1

    test_count = int(summary_match.group("count"))
    if test_count < MIN_EXPECTED_TESTS:
        print(
            f"Numero di test frontend insufficiente: {test_count} superati, "
            f"minimo richiesto {MIN_EXPECTED_TESTS}. "
            "Se sono stati aggiunti test, aggiorna MIN_EXPECTED_TESTS.",
            file=sys.stderr,
        )
        return 1

    print(f"{summary} — {chrome_version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
