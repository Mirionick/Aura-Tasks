#!/usr/bin/env python3
"""Controlli di conformità della CI (passo 0a di P-002), senza dipendenze.

Su ogni Pull Request, con BASE_SHA e HEAD_SHA (gli estremi della PR):
  (a) nelle righe aggiunte dalla PR e nei messaggi dei suoi commit niente segreti, percorsi locali né email
      personali; i commit firmati solo con l'identità noreply di GitHub (AGENTS.md, regola 1). Con il segreto
      facoltativo PRIVACY_TERMS (parole separate da virgole o a capo, per esempio il nome reale) cerca anche quelle;
  (c) se cambiano i file dell'app, cambia anche CACHE_VERSION di app-attivita/sw.js, con un numero più alto di
      quello della base.
Sempre, anche sui push su main:
  (b) nel codice dell'app niente innerHTML né altri modi di scrivere HTML costruito a mano (AGENTS.md, regola 3).

Dice solo dove e che cosa ha trovato, mai il valore (il modello delle PR, «Controllo privacy»).
Dalla cartella del repository: BASE_SHA=… HEAD_SHA=… python3 -B .github/scripts/check-compliance.py
"""
from __future__ import annotations

import os
import pathlib
import re
import subprocess
import sys

REPO = pathlib.Path(__file__).resolve().parents[2]
APP = "app-attivita"
SHA = re.compile(r"^[0-9a-f]{40}$")

# (a) Che cosa non deve entrare in un repository pubblico. Le espressioni sono scritte in modo da non trovare se stesse.
SECRETS = [
    ("chiave privata", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("token di GitHub", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})")),
    ("chiave di un servizio di IA", re.compile(r"\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}")),
    ("chiave di AWS", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("chiave di Google", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")),
    ("token di Slack", re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}")),
    ("valore di un segreto", re.compile(
        r"(?i)\b(?:secret|password|passwd|api[_-]?key|private[_-]?key|access[_-]?token|client[_-]?secret)\b"
        r"[\"']?\s*[:=]\s*[\"'][^\"'\s]{12,}[\"']")),
]
PATHS = [
    ("percorso di Windows", re.compile(r"\b[A-Za-z]:\\[A-Za-z0-9_$.~-]")),
    ("percorso di Windows", re.compile(r"\b[A-Za-z]:/(?:Users|Documents and Settings)/", re.IGNORECASE)),
    ("cartella personale", re.compile(r"(?<![\w.~-])/(?:home|Users|root)/[^/\s\"'`<>)]+")),
    ("cartella temporanea o di un disco", re.compile(r"(?<![\w.~-])/(?:tmp|mnt|private/var|var/folders)/[^/\s\"'`<>)]+")),
    ("cartella personale con la tilde", re.compile(r"(?<![\w/])~[\\/][A-Za-z]")),
    ("nome breve di Windows con la tilde", re.compile(r"\b[A-Z0-9]{1,6}~[0-9]\b")),
]
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")
# Identità noreply di GitHub (anche quella dei commit fatti dal sito), di Claude nei «Co-Authored-By» e indirizzi d'esempio
NOREPLY = re.compile(r"^(?:[0-9]+\+)?[A-Za-z0-9-]+@users\.noreply\.github\.com$|^noreply@github\.com$", re.IGNORECASE)
EMAIL_OK = re.compile(r"^noreply@anthropic\.com$|@example\.(?:com|org|net)$", re.IGNORECASE)

# (b) Il codice dell'app: niente HTML scritto a mano (i test hanno le loro pagine e restano fuori)
HTML_APIS = re.compile(
    r"\.\s*(?:inner|outer)HTML\b|\binsertAdjacentHTML\b|\bdocument\s*\.\s*write(?:ln)?\b|\bcreateContextualFragment\b"
    r"|\bparseFromString\b")

# (c) File dell'app che non contano per la versione della cache: documenti e test non arrivano al telefono
NOT_APP = re.compile(r"^app-attivita/(?:docs|tests)/|\.md$")
CACHE_VERSION = re.compile(r"^const CACHE_VERSION = '([^']+)';", re.MULTILINE)


def git(repo: pathlib.Path, *args: str) -> str:
    result = subprocess.run(["git", "-c", "core.quotePath=false", *args], cwd=repo, capture_output=True, text=True,
                            encoding="utf-8", errors="replace", check=False)
    if result.returncode != 0:
        raise RuntimeError("git " + args[0] + " non riuscito: " + result.stderr.strip())
    return result.stdout


def scan_line(line: str, terms: list[str]) -> list[str]:
    """Che cosa c'è in una riga che non deve finire nel repository: un elenco di tipi, senza i valori."""
    found = [kind for kind, pattern in SECRETS + PATHS if pattern.search(line)]
    if any(not NOREPLY.search(email) and not EMAIL_OK.search(email) for email in EMAIL.findall(line)):
        found.append("email")
    if any(re.search(r"(?<!\w)" + re.escape(term) + r"(?!\w)", line, re.IGNORECASE) for term in terms):
        found.append("dato personale (PRIVACY_TERMS)")
    return list(dict.fromkeys(found))


def added_lines(repo: pathlib.Path, base: str, head: str):
    """(file, numero di riga, testo) di ogni riga aggiunta dalla PR: da dove parte la PR (merge-base) fino a head.
    Le righe di ogni blocco si contano con la sua intestazione, così una riga che comincia con «+++» resta una riga."""
    diff = git(repo, "diff", "--no-color", "--no-ext-diff", "--unified=0", "--diff-filter=AMR", "-M", base + "..." + head)
    path, number, new_left, old_left = None, 0, 0, 0
    for line in diff.split("\n"):
        if new_left > 0 or old_left > 0:
            if line.startswith("+"):
                if path is not None:
                    yield path, number, line[1:]
                number += 1
                new_left -= 1
            elif line.startswith("-"):
                old_left -= 1
            elif line.startswith(" "):
                number += 1
                new_left -= 1
                old_left -= 1
            continue  # «\ No newline at end of file» non conta
        if line.startswith("diff --git "):
            path = None
        elif line.startswith("+++ "):
            path = line[6:] if line.startswith("+++ b/") else None
        elif line.startswith("@@"):
            match = re.match(r"@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", line)
            if match:
                old_left = int(match.group(1)) if match.group(1) is not None else 1
                number = int(match.group(2))
                new_left = int(match.group(3)) if match.group(3) is not None else 1


def check_added_lines(repo: pathlib.Path, base: str, head: str, terms: list[str]) -> list[str]:
    problems = []
    for path, number, text in added_lines(repo, base, head):
        for kind in scan_line(text, terms):
            problems.append(f"{path}:{number}: {kind}")
    return problems


def check_commits(repo: pathlib.Path, base: str, head: str, terms: list[str]) -> list[str]:
    problems = []
    log = git(repo, "log", "--format=%H%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%B%x1e", base + ".." + head)
    for record in log.split("\x1e"):
        fields = record.strip("\n").split("\x1f")
        if len(fields) != 6:
            continue
        sha, author, author_email, committer, committer_email, message = fields
        short = sha[:7]
        if not NOREPLY.search(author_email) or not NOREPLY.search(committer_email):
            problems.append(f"commit {short}: firma senza l'identità noreply di GitHub")
        if any("dato personale (PRIVACY_TERMS)" in scan_line(who, terms) for who in (author, committer)):
            problems.append(f"commit {short}: dato personale (PRIVACY_TERMS) nel nome della firma")
        for number, line in enumerate(message.split("\n"), 1):
            for kind in scan_line(line, terms):
                problems.append(f"commit {short}, riga {number} del messaggio: {kind}")
    return problems


def check_inner_html(app_dir: pathlib.Path) -> list[str]:
    """Il codice dell'app (index.html senza i commenti, sw.js, js/ e prove/) non scrive HTML a mano."""
    problems = []
    files = [app_dir / "index.html", app_dir / "sw.js", *sorted((app_dir / "js").rglob("*.js")),
             *sorted(p for p in (app_dir / "prove").rglob("*") if p.suffix in (".js", ".html"))]
    for file in files:
        if not file.is_file():
            continue
        text = file.read_text(encoding="utf-8")
        if file.suffix == ".html":
            # I commenti diventano spazi e i loro a capo restano: i numeri di riga sono quelli del file
            text = re.sub(r"<!--.*?-->", lambda m: re.sub(r"[^\n]", " ", m.group(0)), text, flags=re.DOTALL)
        for number, line in enumerate(text.split("\n"), 1):
            if HTML_APIS.search(line):
                problems.append(f"{file.relative_to(app_dir.parent).as_posix()}:{number}: HTML scritto a mano "
                                "(innerHTML o simili): i testi si scrivono con textContent")
    return problems


def cache_version(repo: pathlib.Path, ref: str) -> str | None:
    try:
        match = CACHE_VERSION.search(git(repo, "show", ref + ":" + APP + "/sw.js"))
    except RuntimeError:
        return None
    return match.group(1) if match else None


def version_number(version: str) -> int | None:
    match = re.search(r"-v([0-9]+)$", version)
    return int(match.group(1)) if match else None


def check_cache_version(repo: pathlib.Path, base: str, head: str) -> str | None:
    names = git(repo, "diff", "--name-only", "--no-renames", base + "..." + head, "--", APP).split("\n")
    changed = [name for name in names if name and not NOT_APP.search(name)]
    if not changed:
        return None
    start = git(repo, "merge-base", base, head).strip()
    new = cache_version(repo, head)
    if new is None:
        return "CACHE_VERSION non trovata in " + APP + "/sw.js"
    for ref, label in ((start, "da cui parte la PR"), (base, "della base, cioè main adesso")):
        old = cache_version(repo, ref)
        if old is None:
            continue
        old_number, new_number = version_number(old), version_number(new)
        if new == old or (old_number is not None and new_number is not None and new_number <= old_number):
            return (f"Cambiano i file dell'app ({len(changed)}, per esempio {changed[0]}), ma CACHE_VERSION di sw.js "
                    f"({new}) non è più alta di quella {label} ({old}): va alzata, con VERSION di js/update.js, "
                    "altrimenti i telefoni restano alla versione di prima.")
    return None


def privacy_terms() -> list[str]:
    raw = os.environ.get("PRIVACY_TERMS", "")
    return [term.strip() for term in re.split(r"[\n,]", raw) if len(term.strip()) >= 3]


def main() -> int:
    base = os.environ.get("BASE_SHA", "").strip()
    head = os.environ.get("HEAD_SHA", "").strip()
    problems = check_inner_html(REPO / APP)
    if base or head:
        if not SHA.match(base) or not SHA.match(head):
            print("BASE_SHA e HEAD_SHA devono essere due commit (40 cifre esadecimali)", file=sys.stderr)
            return 1
        terms = privacy_terms()
        problems += check_added_lines(REPO, base, head, terms)
        problems += check_commits(REPO, base, head, terms)
        problem = check_cache_version(REPO, base, head)
        if problem:
            problems.append(problem)
        done = "segreti, percorsi locali ed email nelle righe aggiunte e nei commit" + \
               (" (con PRIVACY_TERMS)" if terms else "") + "; firme noreply; versione della cache; innerHTML"
    else:
        done = "innerHTML (senza una PR gli altri controlli non servono)"
    if problems:
        print("Controlli di conformità: da sistemare (si dice solo dove, mai il valore trovato):", file=sys.stderr)
        for problem in problems:
            print("  " + problem, file=sys.stderr)
        return 1
    print("Controlli di conformità superati: " + done)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
