#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Které otázky z banky se ptají na který druh sítě -> src/data/site-otazky.json.

Proč skript a ne ruční seznam: ruční seznam zestárne při každém importu banky
a nikdo si toho nevšimne. Tohle se dá spustit znovu a výsledek porovnat.

Hledá **kódy sítí přesně tak, jak je píše TIČR**, a to case-sensitive. Malé
„it" je v češtině běžná slabika, takže hledat ho bez ohledu na velikost písmen
by vytáhlo desítky nesouvisejících otázek.

Spouštěj izolovaně:  python3 -I scripts/build_site_topics.py
"""

import json
import os
import re
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUESTIONS = os.path.join(ROOT, "src", "data", "questions.2027.json")
DRUHY = os.path.join(ROOT, "src", "data", "site.json")
OUT = os.path.join(ROOT, "src", "data", "site-otazky.json")

HRANICE = r"(?<![\w-])%s(?![\w-])"

# Pořadí rozhoduje: TN-C-S se musí poznat dřív než TN-C a TN-S, jinak by
# otázka na TN-C-S spadla do obou kratších kódů.
VZORY = [
    ("tn-c-s", re.compile(HRANICE % "TN-C-S")),
    ("tn-c", re.compile(HRANICE % "TN-C")),
    ("tn-s", re.compile(HRANICE % "TN-S")),
    ("tt", re.compile(HRANICE % "TT")),
    ("it", re.compile(HRANICE % "IT")),
]

# Otázky o sítích TN obecně, o vodiči PEN a o samotném označování sítí.
# Nepatří pod jediný druh, a přitom je to jádro tématu.
SPOLECNE = re.compile(
    r"(?<![\w-])TN(?![\w-])|(?<![\w-])PEN(?![\w-])|způsob[ue] uzemnění|druhy sítí",
)


def spocitej(bank, druhy):
    """Přiřazení otázek k druhům sítí. Oddělené od zápisu, aby se stejným
    kódem dala kontrola ověřit, že je generovaný soubor aktuální."""
    temata = {d: [] for d in druhy}
    temata["spolecne"] = []

    for q in bank["questions"]:
        text = q["text"]
        nalezene = set()
        zbytek = text
        for key, vzor in VZORY:
            if vzor.search(zbytek):
                nalezene.add(key)
                # Sežrat nalezený kód, aby TN-C-S nespadlo ještě do TN-C.
                zbytek = vzor.sub(" ", zbytek)
        for key in nalezene:
            temata[key].append(q["id"])
        if not nalezene and SPOLECNE.search(text):
            temata["spolecne"].append(q["id"])

    for key in temata:
        temata[key].sort()
    return temata


def main():
    with open(QUESTIONS, encoding="utf-8") as fh:
        bank = json.load(fh)
    with open(DRUHY, encoding="utf-8") as fh:
        druhy = [d["id"] for d in json.load(fh)["druhy"]]

    temata = spocitej(bank, druhy)

    out = {
        "schemaVersion": 1,
        "generovano": date.today().isoformat(),
        "skript": "scripts/build_site_topics.py",
        "bankVersion": bank["bankVersion"],
        "poznamka": (
            "Generovaný soubor. Obsahuje jen ID otázek z banky, ne jejich znění "
            "ani odpovědi. Přiřazení je podle kódu sítě ve znění otázky, tedy "
            "mechanické — otázka, která se druhu sítě týká věcně, ale kód "
            "nejmenuje, tu není."
        ),
        "temata": temata,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print("Témata sítí -> {}".format(os.path.relpath(OUT, ROOT)))
    for key in list(temata):
        print("  {:10} {:>3} otázek".format(key, len(temata[key])))
    return 0


if __name__ == "__main__":
    sys.exit(main())
