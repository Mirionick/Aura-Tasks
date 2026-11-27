#!/usr/bin/env python3
"""Test dei controlli che run-frontend-tests.py fa prima dei test dell'app: la versione uguale in sw.js e in
js/update.js, e le misure del testo di css/style.css che seguono «Dimensione testo» dell'iPhone.

Senza dipendenze. Dalla cartella del repository:
    python3 -B -m unittest discover -s .github/scripts -p "test_*.py"
"""
from __future__ import annotations

import importlib.util
import pathlib
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("run_frontend_tests", HERE / "run-frontend-tests.py")
runner = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(runner)
REAL_APP_DIR = runner.APP_DIR


class FakeApp(unittest.TestCase):
    """Ogni test scrive i suoi file in una cartella dell'app finta, che prende il posto di quella vera."""

    def setUp(self) -> None:
        self._dir = tempfile.TemporaryDirectory()
        self.app = pathlib.Path(self._dir.name)
        runner.APP_DIR = self.app

    def tearDown(self) -> None:
        runner.APP_DIR = REAL_APP_DIR
        self._dir.cleanup()

    def write(self, name: str, text: str) -> None:
        path = self.app / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")


class FontSizes(FakeApp):
    def problems(self, css: str) -> list[str]:
        """Le righe segnalate da check_font_sizes() per questo foglio di stile, oppure [] se lo accetta."""
        self.write("css/style.css", css)
        message = runner.check_font_sizes()
        if message is None:
            return []
        return [line.strip() for line in message.splitlines() if line.startswith("  riga ")]

    def test_accetta_le_misure_che_crescono_con_il_testo(self) -> None:
        css = "\n".join([
            "html { font-size: 106.25%; }",
            ".a { font-size: calc(15 * var(--px)); }",
            ".b { font-size: calc(13 * var(--px-ui)); }",
            ".c { font-size: max(16px, calc(16 * var(--px))); }",
            ".d { font-size: clamp(calc(22 * var(--px)), 6.2vw, calc(26 * var(--px))); }",
            ".e {",
            "  font-size: calc(12 * var(--px));",
            "}",
            ".f { font-size: 1.2em; }",
            ".g { font-size: inherit; }",
            "@supports (font: -apple-system-body) { html { font: -apple-system-body; } }",
        ])
        self.assertEqual(self.problems(css), [])

    def test_accetta_un_px_fisso_che_dice_perche(self) -> None:
        css = "\n".join([
            ".emoji { font-size: 24px; line-height: 1; } /* px fisso: emoji nel riquadro */",
            ".timer {",
            "  font-size: clamp(40px, min(16vw, 8.5vh), 76px); /* px fisso: il timer segue lo schermo */",
            "}",
        ])
        self.assertEqual(self.problems(css), [])

    def test_ferma_un_px_senza_var_px_e_senza_commento(self) -> None:
        css = "\n".join([
            ".a { font-size: calc(15 * var(--px)); }",
            ".b { font-size: 15px; }",
            ".c {",
            "  font-size: clamp(12px, 3vw, 18px);",
            "}",
            ".d { font-size: 13px; } /* in px perché sì */",
        ])
        self.assertEqual(self.problems(css), [
            "riga 2: font-size: 15px",
            "riga 4: font-size: clamp(12px, 3vw, 18px)",
            "riga 6: font-size: 13px",
        ])

    def test_guarda_ogni_dichiarazione_della_riga(self) -> None:
        css = ".a { font-size: calc(15 * var(--px)); } .b { font-size: 14px; }"
        self.assertEqual(self.problems(css), ["riga 1: font-size: 14px"])

    def test_il_messaggio_spiega_la_regola(self) -> None:
        self.write("css/style.css", ".b { font-size: 15px; }\n")
        message = runner.check_font_sizes()
        self.assertIn("calc(N * var(--px))", message)
        self.assertIn("px fisso", message)


class Versions(FakeApp):
    def versions(self, cache: str, page: str) -> str | None:
        self.write("sw.js", f"// Service worker\nconst CACHE_VERSION = '{cache}';\nconst APP_FILES = [];\n")
        self.write("js/update.js", f"(function (Aura) {{\n  const VERSION = '{page}';\n}})(window.Aura);\n")
        return runner.check_versions()

    def test_accetta_due_versioni_uguali(self) -> None:
        self.assertIsNone(self.versions("aura-tasks-v27", "aura-tasks-v27"))

    def test_ferma_due_versioni_diverse(self) -> None:
        message = self.versions("aura-tasks-v28", "aura-tasks-v27")
        self.assertIn("aura-tasks-v28", message)
        self.assertIn("aura-tasks-v27", message)

    def test_ferma_una_versione_che_manca(self) -> None:
        self.write("sw.js", "const CACHE_VERSION = 'aura-tasks-v27';\n")
        self.write("js/update.js", "(function () {})();\n")
        self.assertEqual(runner.check_versions(), "Versione non trovata in js/update.js")


class RealApp(unittest.TestCase):
    """I file veri del repository passano i due controlli."""

    def test_il_foglio_di_stile_segue_dimensione_testo(self) -> None:
        self.assertIsNone(runner.check_font_sizes())

    def test_la_versione_e_uguale_nei_due_posti(self) -> None:
        self.assertIsNone(runner.check_versions())


if __name__ == "__main__":
    unittest.main()
