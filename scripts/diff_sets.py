#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Porovná sadu otázek platnou do 31. 12. 2026 se sadou platnou od 1. 1. 2027.

K čemu to je: školicí materiály, vypracované otázky a cizí přípravy jsou
ke **staré** sadě. Bez porovnání se nedá říct, která z nich ještě platí.
Tenhle skript to řekne přesně — které otázky jsou nové, které zmizely a které
se přeformulovaly.

Porovnává se **znění otázky, ne číslo.** Čísla se mezi sadami posunula;
spoléhat na ně by vedlo k tomu, že se člověk naučí odpověď na jinou otázku.

Prahy shody:
    >= 0.92  beze změny (nanejvýš úprava interpunkce)
    0.60–0.92 přeformulovaná — porovnat ručně, může se změnit i odpověď
    < 0.60   bez protějšku

Vstup:  data/stara/txt/*.txt  (stará sada, rozbalená a převedená)
        src/data/questions.2027.json  (nová sada)
Výstup: docs/ZMENY-2027.md

Spouštěj izolovaně:  python3 -I scripts/diff_sets.py
"""

import difflib
import importlib.util
import json
import os
import re
import sys
import unicodedata
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STARA_TXT = os.path.join(ROOT, "data", "stara", "txt")
NOVA = os.path.join(ROOT, "src", "data", "questions.2027.json")
OUT = os.path.join(ROOT, "docs", "ZMENY-2027.md")

SHODA = 0.92
PODOBNA = 0.60

# Soubor staré sady -> okruh nové sady. Pojmenování se mezi sadami změnilo,
# mimo jiné z „hromosvody" na „LPS".
MAPOVANI = {
    "ez1_obecny_test": "ez1",
    "ez2_ochrana_pred_ndn": "ez2",
    "ez3_vseobecne_pozadavky_na_elektricka_zarizeni": "ez3",
    "ez4_hromosvody_v_prostredi_bez_nebezpeci_vybuchu": "ez4",
}


def nacti_importer():
    spec = importlib.util.spec_from_file_location(
        "import_ticr", os.path.join(ROOT, "scripts", "import_ticr.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()


def main():
    imp = nacti_importer()
    nova = json.load(open(NOVA, encoding="utf-8"))

    radky = []
    souhrn = []

    for soubor, okruh in MAPOVANI.items():
        cesta = os.path.join(STARA_TXT, soubor + ".txt")
        if not os.path.exists(cesta):
            print("Chybí {} — stáhni starou sadu.".format(cesta), file=sys.stderr)
            return 2
        bloky, _ = imp.parse_file(cesta, okruh)
        stare = imp.build_questions(okruh, okruh, bloky, [])
        nove = [q for q in nova["questions"] if q["circuit"] == okruh]

        sn = [(q, norm(q["text"])) for q in stare]
        nn = [(q, norm(q["text"])) for q in nove]

        pouzite_stare = set()
        beze_zmeny, zmenene, nove_bez = [], [], []
        for q, n in nn:
            nej, nejr = None, 0.0
            for sq, s in sn:
                if sq["number"] in pouzite_stare:
                    continue
                r = difflib.SequenceMatcher(None, n, s).ratio()
                if r > nejr:
                    nej, nejr = sq, r
            if nejr >= SHODA:
                beze_zmeny.append((q, nej, nejr)); pouzite_stare.add(nej["number"])
            elif nejr >= PODOBNA:
                zmenene.append((q, nej, nejr)); pouzite_stare.add(nej["number"])
            else:
                nove_bez.append((q, nej, nejr))
        vypadle = [sq for sq, _ in sn if sq["number"] not in pouzite_stare]

        souhrn.append((okruh, len(stare), len(nove), len(beze_zmeny),
                       len(zmenene), len(nove_bez), len(vypadle)))
        radky.append((okruh, beze_zmeny, zmenene, nove_bez, vypadle))

    with open(OUT, "w", encoding="utf-8") as fh:
        w = lambda s="": fh.write(s + "\n")
        w("# Co se změnilo mezi sadami otázek TIČR")
        w()
        w("Porovnání sady **platné do 31. 12. 2026** se sadou **platnou od 1. 1. 2027**,")
        w("obě z oficiálního zdroje TIČR. Sestaveno {} skriptem".format(date.today().isoformat()))
        w("`scripts/diff_sets.py`.")
        w()
        w("Porovnává se **znění otázky, ne její číslo** — čísla se mezi sadami posunula.")
        w("Hranice: shoda ≥ {:.2f} je „beze změny\", {:.2f} až {:.2f} „přeformulovaná\",".format(
            SHODA, PODOBNA, SHODA))
        w("pod {:.2f} „bez protějšku\". U přeformulovaných otázek se mohla změnit".format(PODOBNA))
        w("i správná odpověď — starou odpověď k nim nelze převzít bez porovnání.")
        w()
        w("| Okruh | Stará sada | Nová sada | Beze změny | Přeformulované | Nové | Vypadlé |")
        w("| --- | ---: | ---: | ---: | ---: | ---: | ---: |")
        for o, s, n, b, z, nb, v in souhrn:
            w("| {} | {} | {} | {} | {} | {} | {} |".format(o, s, n, b, z, nb, v))
        t = [sum(x[i] for x in souhrn) for i in range(1, 7)]
        w("| **celkem** | **{}** | **{}** | **{}** | **{}** | **{}** | **{}** |".format(*t))
        w()
        zmeneno = t[3] + t[4]
        w("**Z {} otázek nové sady je {} otázek změněných nebo nových, tedy {:.0f} %.**".format(
            t[1], zmeneno, 100.0 * zmeneno / t[1]))
        w("Z minulé sady vypadlo {} otázek.".format(t[5]))
        w()

        for okruh, beze, zmen, novebez, vypad in radky:
            w("## Okruh {}".format(okruh))
            w()
            w("### Nové otázky bez protějšku ({})".format(len(novebez)))
            w()
            if not novebez:
                w("Žádná.")
            for q, nej, r in novebez:
                w("- `{}` č. {} — {}".format(q["id"], q["number"], q["text"]))
            w()
            w("### Přeformulované ({})".format(len(zmen)))
            w()
            if not zmen:
                w("Žádná.")
            for q, nej, r in sorted(zmen, key=lambda x: x[2]):
                w("- `{}` č. {} (shoda {:.2f})".format(q["id"], q["number"], r))
                w("  - nově: {}".format(q["text"]))
                w("  - dříve: {}".format(nej["text"] if nej else "—"))
            w()
            w("### Vypadlé z minulé sady ({})".format(len(vypad)))
            w()
            if not vypad:
                w("Žádná.")
            for sq in vypad:
                w("- č. {} — {}".format(sq["number"], sq["text"]))
            w()

    print("Porovnání -> {}".format(os.path.relpath(OUT, ROOT)))
    print("| okruh | stará | nová | beze změny | přeformulované | nové | vypadlé |")
    for o, s, n, b, z, nb, v in souhrn:
        print("  {}  {:>4} {:>4}   {:>4} {:>4} {:>4} {:>4}".format(o, s, n, b, z, nb, v))
    print("  celkem {} -> {}, změněných nebo nových {}".format(t[0], t[1], t[3] + t[4]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
