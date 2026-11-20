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
MIN_EXPECTED_TESTS = 251


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        pass


def find_chrome() -> str:
    for candidate in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        executable = shutil.which(candidate)
        if executable:
            return executable
    raise RuntimeError("Chrome/Chromium non trovato nel runner GitHub Actions")


def main() -> int:
    if not (APP_DIR / "tests" / "index.html").is_file():
        print(f"Pagina di test non trovata: {APP_DIR / 'tests' / 'index.html'}", file=sys.stderr)
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
