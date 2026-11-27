#!/usr/bin/env python3
"""Test di check-compliance.py, i controlli di conformità della CI (passo 0a di P-002).

Senza dipendenze. Dalla cartella del repository:
    python3 -B -m unittest discover -s .github/scripts -p "test_*.py"

I campioni da trovare si costruiscono a pezzi: scritti interi, li troverebbe il controllo stesso, che sulla PR legge
anche questo file.
"""
from __future__ import annotations

import importlib.util
import os
import pathlib
import subprocess
import tempfile
import unittest
from unittest import mock

HERE = pathlib.Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("check_compliance", HERE / "check-compliance.py")
cc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(cc)

BS = "\\"
WINDOWS = "C:" + BS + "Users" + BS + "nome" + BS + "Aura"
HOME = "/" + "home/nome/aura"
PERSONAL = "nome.cognome" + "@" + "esempio.it"
NOREPLY = "116272782+Mirionick@users.noreply.github.com"
TERM = "Pinco"


class ScanLine(unittest.TestCase):
    def kinds(self, line: str, terms: list[str] | None = None) -> list[str]:
        return cc.scan_line(line, terms or [])

    def test_trova_i_segreti(self) -> None:
        samples = {
            "-----BEGIN " + "PRIVATE KEY-----": "chiave privata",
            "-----BEGIN " + "EC PRIVATE KEY-----": "chiave privata",
            "token: gh" + "p_" + "a" * 36: "token di GitHub",
            "github" + "_pat_" + "A" * 30: "token di GitHub",
            "s" + "k-" + "x" * 24: "chiave di un servizio di IA",
            "s" + "k-ant-" + "y" * 30: "chiave di un servizio di IA",
            "AK" + "IA" + "ABCDEFGHIJKLMNOP": "chiave di AWS",
            "AI" + "za" + "b" * 35: "chiave di Google",
            "xo" + "xb-" + "1234567890ab": "token di Slack",
            "pass" + "word = \"" + "abcdefghijklmn\"": "valore di un segreto",
            "\"client_" + "secret\": \"" + "q" * 20 + "\"": "valore di un segreto",
        }
        for line, kind in samples.items():
            with self.subTest(kind=kind):
                self.assertIn(kind, self.kinds(line))

    def test_trova_i_percorsi_locali(self) -> None:
        samples = {
            WINDOWS: "percorso di Windows",
            "D:" + BS + "Progetti" + BS + "aura": "percorso di Windows",
            "C:" + "/" + "Users/nome/Desktop": "percorso di Windows",
            HOME: "cartella personale",
            "vedi (/" + "Users/nome/Desktop/aura)": "cartella personale",
            "\"/" + "root/.config\"": "cartella personale",
            "Merge branch 'x' of /" + "tmp/aura-pr into y": "cartella temporanea o di un disco",
            "/" + "mnt/c/Users/nome": "cartella temporanea o di un disco",
            "/" + "var/folders/ab/cd": "cartella temporanea o di un disco",
            "~" + "/Documents/Aura": "cartella personale con la tilde",
            "~" + BS + "Documenti" + BS + "Aura": "cartella personale con la tilde",
            "NOMECO" + "~1" + BS + "AppData": "nome breve di Windows con la tilde",
        }
        for line, kind in samples.items():
            with self.subTest(line=repr(line)):
                self.assertIn(kind, self.kinds(line))

    def test_trova_le_email_personali_e_lascia_le_noreply(self) -> None:
        self.assertEqual(self.kinds("scrivimi a " + PERSONAL), ["email"])
        self.assertEqual(self.kinds("Autore: Mirionick <" + NOREPLY + ">"), [])
        self.assertEqual(self.kinds("Co-Authored-By: Claude <noreply@anthropic.com>"), [])
        self.assertEqual(self.kinds("Merge: GitHub <noreply@github.com>"), [])
        self.assertEqual(self.kinds("per esempio prova@example.com"), [])

    def test_il_testo_normale_passa(self) -> None:
        for line in [
            "https://github.com/Mirionick/Aura-Tasks/pull/27",
            "https://example.com/home/pagina e https://example.com/Users/elenco e https://example.com/tmp/x",
            "#!/usr/bin/env python3",
            "Ore 9:30, alle 10:00; const time = '09:25';",
            "il percorso relativo app-attivita/js/app.js e $env:TEMP",
            "a ~ b, x & ~1, ~/ da solo",
            "password: '', token = null, sk-corta",
            "AKIA da solo, ghp_ corto",
            "Tempo finito: Relazione · «Aggiungi ad Aura»",
        ]:
            with self.subTest(line=line):
                self.assertEqual(self.kinds(line), [])

    def test_privacy_terms_parole_intere_senza_maiuscole(self) -> None:
        self.assertEqual(self.kinds("Il mio nome è " + TERM + " Pallino", [TERM]), ["dato personale (PRIVACY_TERMS)"])
        self.assertEqual(self.kinds(TERM.upper() + ".", [TERM]), ["dato personale (PRIVACY_TERMS)"])
        self.assertEqual(self.kinds(TERM + "pallino", [TERM]), [], "dentro un'altra parola no")
        self.assertEqual(self.kinds("niente qui", [TERM]), [])

    def test_privacy_terms_dal_segreto(self) -> None:
        with mock.patch.dict(os.environ, {"PRIVACY_TERMS": TERM + ", Pallino\nxy\n\n"}):
            self.assertEqual(cc.privacy_terms(), [TERM, "Pallino"], "le parole di meno di 3 lettere no")
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual(cc.privacy_terms(), [])

    def test_i_file_del_controllo_non_trovano_se_stessi(self) -> None:
        for name in ("check-compliance.py", "test_check_compliance.py"):
            text = (HERE / name).read_text(encoding="utf-8")
            for number, line in enumerate(text.split("\n"), 1):
                with self.subTest(file=name, line=number):
                    self.assertEqual(cc.scan_line(line, []), [])


class GitRepo(unittest.TestCase):
    """Un repository finto in una cartella temporanea, con commit firmati come si vuole."""

    def setUp(self) -> None:
        self._dir = tempfile.TemporaryDirectory()
        self.repo = pathlib.Path(self._dir.name)
        self.git("init", "-q", "-b", "main")

    def tearDown(self) -> None:
        self._dir.cleanup()

    def git(self, *args: str, name: str = "Mirionick", email: str = NOREPLY) -> str:
        env = dict(os.environ, GIT_AUTHOR_NAME=name, GIT_AUTHOR_EMAIL=email, GIT_COMMITTER_NAME=name,
                   GIT_COMMITTER_EMAIL=email, GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_NOSYSTEM="1")
        result = subprocess.run(["git", *args], cwd=self.repo, env=env, capture_output=True, text=True, check=True)
        return result.stdout.strip()

    def write(self, name: str, text: str) -> None:
        path = self.repo / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def commit(self, message: str, **identity: str) -> str:
        self.git("add", "-A")
        self.git("commit", "-q", "-m", message, **identity)
        return self.git("rev-parse", "HEAD")


class AddedLines(GitRepo):
    def test_solo_le_righe_aggiunte_dalla_pr_con_il_numero_giusto(self) -> None:
        self.write("docs/a.md", WINDOWS + "\nuno\ndue\n")  # c'era già: non è della PR
        base = self.commit("base")
        self.git("checkout", "-q", "-b", "pr")
        self.write("docs/a.md", WINDOWS + "\nuno\ndue\ntre " + HOME + "\n")
        self.write("b.txt", "ok\n++ " + WINDOWS + "\nok\n")  # nel diff diventa «+++ …», ma è una riga
        head = self.commit("pr")
        self.assertEqual(sorted(cc.check_added_lines(self.repo, base, head, [])),
                         ["b.txt:2: percorso di Windows", "docs/a.md:4: cartella personale"])

    def test_cio_che_arriva_da_main_non_conta(self) -> None:
        self.write("a.txt", "uno\n")
        self.commit("base")
        self.git("checkout", "-q", "-b", "pr")
        self.write("b.txt", "pulito\n")
        head = self.commit("pr")
        self.git("checkout", "-q", "main")
        self.write("c.txt", HOME + "\n")
        main = self.commit("altro su main")
        self.assertEqual(cc.check_added_lines(self.repo, main, head, []), [])

    def test_una_riga_tolta_su_main_non_sembra_aggiunta_dalla_pr(self) -> None:
        self.write("a.txt", "uno\n" + HOME + "\n")  # c'era già prima della PR
        self.commit("base")
        self.git("checkout", "-q", "-b", "pr")
        self.write("b.txt", "pulito\n")
        head = self.commit("pr")
        self.git("checkout", "-q", "main")
        self.write("a.txt", "uno\n")  # main la toglie: confrontando con main, la PR sembrerebbe rimetterla
        main = self.commit("tolta su main")
        self.assertEqual(cc.check_added_lines(self.repo, main, head, []), [])

    def test_il_valore_trovato_non_si_stampa(self) -> None:
        self.write("a.txt", "uno\n")
        base = self.commit("base")
        self.write("a.txt", "uno\n" + PERSONAL + " " + TERM + "\n")
        head = self.commit("pr")
        problems = cc.check_added_lines(self.repo, base, head, [TERM])
        self.assertEqual(problems, ["a.txt:2: email", "a.txt:2: dato personale (PRIVACY_TERMS)"])
        self.assertNotIn(TERM, "\n".join(problems))
        self.assertNotIn(PERSONAL, "\n".join(problems))


class Commits(GitRepo):
    def test_firme_noreply_e_messaggi_puliti_passano(self) -> None:
        self.write("a.txt", "uno\n")
        base = self.commit("base")
        self.write("a.txt", "due\n")
        head = self.commit("Cambia a\n\nCo-Authored-By: Claude <noreply@anthropic.com>")
        self.assertEqual(cc.check_commits(self.repo, base, head, [TERM]), [])

    def test_firma_personale_percorso_nel_messaggio_e_nome_reale(self) -> None:
        self.write("a.txt", "uno\n")
        base = self.commit("base")
        self.write("a.txt", "due\n")
        first = self.commit("Firma sbagliata", email=PERSONAL)
        self.write("a.txt", "tre\n")
        second = self.commit("Titolo\n\nCopiato da " + WINDOWS)
        self.write("a.txt", "quattro\n")
        third = self.commit("Nome reale", name=TERM + " Pallino")
        problems = cc.check_commits(self.repo, base, third, [TERM])
        self.assertEqual(sorted(problems), sorted([
            "commit " + first[:7] + ": firma senza l'identità noreply di GitHub",
            "commit " + second[:7] + ", riga 3 del messaggio: percorso di Windows",
            "commit " + third[:7] + ": dato personale (PRIVACY_TERMS) nel nome della firma",
        ]))
        self.assertNotIn(TERM, "\n".join(problems))
        self.assertNotIn(PERSONAL, "\n".join(problems))

    def test_i_commit_gia_su_main_non_contano(self) -> None:
        self.write("a.txt", "uno\n")
        self.commit("base", email=PERSONAL)  # prima della PR: non è suo
        base = self.git("rev-parse", "HEAD")
        self.write("a.txt", "due\n")
        head = self.commit("pr")
        self.assertEqual(cc.check_commits(self.repo, base, head, []), [])


def sw(version: str) -> str:
    return "const CACHE_VERSION = '" + version + "';\nconst APP_FILES = [];\n"


class CacheVersion(GitRepo):
    def setUp(self) -> None:
        super().setUp()
        self.write("app-attivita/sw.js", sw("aura-tasks-v10"))
        self.write("app-attivita/js/a.js", "uno\n")
        self.write("app-attivita/docs/x.md", "uno\n")
        self.write("app-attivita/tests/t.js", "uno\n")
        self.write("server/src/index.js", "uno\n")
        self.base = self.commit("base")
        self.git("checkout", "-q", "-b", "pr")

    def change(self, files: dict[str, str]) -> str:
        for name, text in files.items():
            self.write(name, text)
        return self.commit("pr")

    def test_file_dell_app_cambiati_senza_versione_nuova(self) -> None:
        head = self.change({"app-attivita/js/a.js": "due\n"})
        problem = cc.check_cache_version(self.repo, self.base, head)
        self.assertIsNotNone(problem)
        self.assertIn("app-attivita/js/a.js", problem)
        self.assertIn("aura-tasks-v10", problem)

    def test_con_la_versione_nuova_passa(self) -> None:
        head = self.change({"app-attivita/js/a.js": "due\n", "app-attivita/sw.js": sw("aura-tasks-v11")})
        self.assertIsNone(cc.check_cache_version(self.repo, self.base, head))

    def test_documenti_test_e_server_non_chiedono_una_versione(self) -> None:
        head = self.change({"app-attivita/docs/x.md": "due\n", "app-attivita/tests/t.js": "due\n",
                            "app-attivita/CLAUDE.md": "nuovo\n", "server/src/index.js": "due\n", "README.md": "x\n"})
        self.assertIsNone(cc.check_cache_version(self.repo, self.base, head))

    def test_una_pr_di_soli_documenti_mentre_main_cambia_l_app(self) -> None:
        head = self.change({"app-attivita/docs/x.md": "due\n"})
        self.git("checkout", "-q", "main")
        self.write("app-attivita/js/a.js", "da main\n")
        self.write("app-attivita/sw.js", sw("aura-tasks-v11"))
        main = self.commit("un'altra PR, unita prima")  # l'app cambia su main, non nella PR
        self.assertIsNone(cc.check_cache_version(self.repo, main, head))

    def test_file_tolti_o_nuovi_contano(self) -> None:
        self.git("rm", "-q", "app-attivita/js/a.js")
        head = self.change({"app-attivita/images/nuova.webp": "x"})
        self.assertIsNotNone(cc.check_cache_version(self.repo, self.base, head))

    def test_una_versione_piu_bassa_non_basta(self) -> None:
        head = self.change({"app-attivita/js/a.js": "due\n", "app-attivita/sw.js": sw("aura-tasks-v9")})
        self.assertIsNotNone(cc.check_cache_version(self.repo, self.base, head))

    def test_main_e_andato_avanti_con_lo_stesso_numero(self) -> None:
        head = self.change({"app-attivita/js/a.js": "due\n", "app-attivita/sw.js": sw("aura-tasks-v11")})
        self.git("checkout", "-q", "main")
        self.write("app-attivita/js/b.js", "altro\n")
        self.write("app-attivita/sw.js", sw("aura-tasks-v11"))
        main = self.commit("un'altra PR, unita prima")
        problem = cc.check_cache_version(self.repo, main, head)
        self.assertIsNotNone(problem)
        self.assertIn("main adesso", problem)
        self.git("checkout", "-q", "pr")
        self.write("app-attivita/sw.js", sw("aura-tasks-v12"))
        head = self.commit("versione dopo quella di main")
        self.assertIsNone(cc.check_cache_version(self.repo, main, head))

    def test_versioni_senza_numero_devono_solo_cambiare(self) -> None:
        self.git("checkout", "-q", "main")
        self.write("app-attivita/sw.js", sw("prima"))
        base = self.commit("versione senza numero")
        self.git("checkout", "-q", "-b", "pr2")
        head = self.change({"app-attivita/js/a.js": "tre\n"})
        self.assertIsNotNone(cc.check_cache_version(self.repo, base, head))
        head = self.change({"app-attivita/sw.js": sw("dopo")})
        self.assertIsNone(cc.check_cache_version(self.repo, base, head))


class InnerHtml(unittest.TestCase):
    def setUp(self) -> None:
        self._dir = tempfile.TemporaryDirectory()
        self.app = pathlib.Path(self._dir.name) / "app-attivita"

    def tearDown(self) -> None:
        self._dir.cleanup()

    def write(self, name: str, text: str) -> None:
        path = self.app / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def test_trova_l_html_scritto_a_mano_nel_codice_dell_app(self) -> None:
        self.write("index.html", "<!-- Modello: lo riempie textContent (mai innerHTML). -->\n<p>ok</p>\n")
        self.write("js/a.js", "el.textContent = testo;\nel.innerHTML = testo;\n")
        self.write("js/sotto/b.js", "node.insertAdjacentHTML('beforeend', x);\n")
        self.write("sw.js", "// niente qui\n")
        self.write("prove/voce.js", "riga.outerHTML = x;\n")
        self.write("tests/runner.js", "out.innerHTML = risultati;\n")  # le pagine dei test restano fuori
        problems = cc.check_inner_html(self.app)
        self.assertEqual([problem.split(": ")[0] for problem in problems],
                         ["app-attivita/js/a.js:2", "app-attivita/js/sotto/b.js:1", "app-attivita/prove/voce.js:1"])

    def test_html_nei_commenti_dell_html_no_ma_fuori_si(self) -> None:
        self.write("index.html", "<!--\nel.innerHTML\n-->\n<p>x</p>\n<script>document.write('x')</script>\n")
        self.assertEqual([problem.split(": ")[0] for problem in cc.check_inner_html(self.app)],
                         ["app-attivita/index.html:5"])

    def test_l_app_vera_passa(self) -> None:
        self.assertEqual(cc.check_inner_html(cc.REPO / cc.APP), [])


class Main(unittest.TestCase):
    def test_senza_pr_solo_innerhtml(self) -> None:
        with mock.patch.dict(os.environ, {"BASE_SHA": "", "HEAD_SHA": ""}):
            self.assertEqual(cc.main(), 0)

    def test_estremi_della_pr_non_validi(self) -> None:
        with mock.patch.dict(os.environ, {"BASE_SHA": "main", "HEAD_SHA": "a" * 40}):
            self.assertEqual(cc.main(), 1)


if __name__ == "__main__":
    unittest.main()
